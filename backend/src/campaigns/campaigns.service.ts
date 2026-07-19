import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignMemberRole, CampaignStatus, SkillLevel, UserRole } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationFormDto, CreateCampaignDto, CreateCampaignPositionDto, UpdateCampaignDto, UpdateCampaignMemberDto, UpdateCampaignPositionDto, UpsertCampaignMemberDto } from './dto/campaign.dto';

type CampaignUser = { id: string; role: string };

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: CampaignUser) {
    const campaigns = await this.prisma.recruitmentCampaign.findMany({
      where: this.campaignAccessWhere(user),
      include: {
        applicationForm: true,
        members: { include: { user: true } },
        campaignPositions: { include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } }, applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((c) => this.toFrontendCampaign(c, user));
  }

  async findAllJobPositions() {
    const positions = await this.prisma.jobPosition.findMany({
      include: {
        jobDescription: true,
        positionSkills: { include: { skill: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return positions.map(p => ({
      id: p.id,
      title: p.title,
      department: p.department,
      seniority: p.seniority,
      employmentType: p.employmentType,
      overview: p.jobDescription?.overview,
      responsibilities: p.jobDescription?.responsibilities,
      requirements: p.jobDescription?.requirements,
      benefits: p.jobDescription?.benefits,
      skills: p.positionSkills.map(ps => ps.skill.name),
    }));
  }

  async findOne(user: CampaignUser, id: string) {
    const campaign = await this.prisma.recruitmentCampaign.findUnique({
      where: { id },
      include: {
        applicationForm: true,
        createdBy: true,
        members: { include: { user: true }, orderBy: { createdAt: 'asc' } },
        campaignPositions: {
          include: {
            position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } },
            applications: { include: { candidateProfile: true, screeningResult: true } },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    this.ensureCanView(user, campaign);
    return campaign;
  }

  async create(userId: string, dto: CreateCampaignDto) {
    const deadline = new Date(dto.deadline);
    if (deadline <= new Date()) throw new BadRequestException('Deadline must be in the future');

    const campaign = await this.prisma.$transaction(async (tx) => {
      const positions = this.normalizeCreatePositions(dto);

      const campaign = await tx.recruitmentCampaign.create({
        data: {
          title: dto.title,
          description: dto.description,
          department: dto.department,
          deadline,
          status: dto.status ?? CampaignStatus.ACTIVE,
          createdById: userId,
          applicationForm: {
            create: { publicToken: uuid(), isPublic: true },
          },
        },
        include: { applicationForm: true, members: { include: { user: true } }, campaignPositions: { include: { position: true, applications: true } } },
      });

      for (const positionDto of positions) {
        await this.createCampaignPosition(tx, campaign.id, userId, positionDto, dto.department);
      }

      await tx.campaignMember.create({
        data: {
          campaignId: campaign.id,
          userId,
          role: CampaignMemberRole.OWNER,
          addedById: userId,
        },
      });
      return tx.recruitmentCampaign.findUniqueOrThrow({
        where: { id: campaign.id },
        include: {
          applicationForm: true,
          members: { include: { user: true } },
          campaignPositions: { include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } }, applications: true } },
        },
      });
    });
    return this.toFrontendCampaign(campaign, { id: userId, role: UserRole.RECRUITER });
  }

  async update(user: CampaignUser, id: string, dto: UpdateCampaignDto) {
    const current = await this.findCampaignForAccess(id);
    this.ensureCanEdit(user, current);
    const data: Record<string, unknown> = { ...dto };
    if (dto.deadline) data.deadline = new Date(dto.deadline);
    const campaign = await this.prisma.recruitmentCampaign.update({
      where: { id },
      data,
      include: { applicationForm: true, members: { include: { user: true } }, campaignPositions: { include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } }, applications: true } } },
    });
    return this.toFrontendCampaign(campaign, user);
  }

  async remove(user: CampaignUser, id: string) {
    const campaign = await this.findCampaignForAccess(id);
    this.ensureCanManageMembers(user, campaign);
    await this.prisma.recruitmentCampaign.delete({ where: { id } });
    return { id };
  }

  async createOrUpdateForm(user: CampaignUser, campaignId: string, dto: CreateApplicationFormDto = {}) {
    const campaign = await this.findCampaignForAccess(campaignId);
    this.ensureCanEdit(user, campaign);
    return this.prisma.applicationForm.upsert({
      where: { campaignId },
      create: {
        campaignId,
        publicToken: uuid(),
        isPublic: dto.isPublic ?? true,
        enabledFields: dto.enabledFields ?? { gpa: true, github: true, portfolio: true, coverLetter: true },
      },
      update: {
        isPublic: dto.isPublic,
        enabledFields: dto.enabledFields,
      },
    });
  }

  async addPosition(user: CampaignUser, campaignId: string, dto: CreateCampaignPositionDto) {
    const campaign = await this.findCampaignForAccess(campaignId);
    this.ensureCanEdit(user, campaign);
    this.validateCreatePosition(dto, 1);

    const campaignPosition = await this.prisma.$transaction((tx) => this.createCampaignPosition(tx, campaignId, user.id, dto, campaign.department ?? undefined));
    const created = await this.prisma.campaignPosition.findUniqueOrThrow({
      where: { id: campaignPosition.id },
      include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } }, applications: true },
    });
    return this.toFrontendPosition(created);
  }

  async updatePosition(user: CampaignUser, campaignId: string, campaignPositionId: string, dto: UpdateCampaignPositionDto) {
    const campaign = await this.findCampaignForAccess(campaignId);
    this.ensureCanEdit(user, campaign);

    const campaignPosition = await this.prisma.campaignPosition.findFirst({
      where: { id: campaignPositionId, campaignId },
      include: { position: { include: { jobDescription: true } } },
    });
    if (!campaignPosition) throw new NotFoundException('Campaign position not found');

    await this.prisma.$transaction(async (tx) => {
      const positionData: Record<string, unknown> = {};
      if (dto.title !== undefined) positionData.title = dto.title;
      if (dto.department !== undefined) positionData.department = dto.department;
      if (dto.seniority !== undefined) positionData.seniority = dto.seniority;
      if (dto.employmentType !== undefined) positionData.employmentType = dto.employmentType;
      if (Object.keys(positionData).length) {
        await tx.jobPosition.update({ where: { id: campaignPosition.positionId }, data: positionData });
      }

      if (dto.vacancies !== undefined) {
        await tx.campaignPosition.update({ where: { id: campaignPosition.id }, data: { vacancies: dto.vacancies } });
      }

      const jobDescriptionData: Record<string, unknown> = {};
      if (dto.overview !== undefined) jobDescriptionData.overview = dto.overview;
      if (dto.responsibilities !== undefined) jobDescriptionData.responsibilities = dto.responsibilities;
      if (dto.requirements !== undefined) jobDescriptionData.requirements = dto.requirements;
      if (dto.benefits !== undefined) jobDescriptionData.benefits = dto.benefits;
      if (Object.keys(jobDescriptionData).length) {
        await tx.jobDescription.upsert({
          where: { positionId: campaignPosition.positionId },
          create: {
            positionId: campaignPosition.positionId,
            overview: (jobDescriptionData.overview as string | undefined) ?? '',
            responsibilities: (jobDescriptionData.responsibilities as string | undefined) ?? '',
            requirements: (jobDescriptionData.requirements as string | undefined) ?? '',
            benefits: jobDescriptionData.benefits as string | undefined,
          },
          update: jobDescriptionData,
        });
      }
    });

    const updated = await this.prisma.campaignPosition.findUniqueOrThrow({
      where: { id: campaignPositionId },
      include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } }, applications: true },
    });
    return this.toFrontendPosition(updated);
  }

  async findMembers(user: CampaignUser, campaignId: string) {
    const campaign = await this.findCampaignForAccess(campaignId);
    this.ensureCanView(user, campaign);
    const members = await this.prisma.campaignMember.findMany({
      where: { campaignId },
      include: { user: { select: { id: true, email: true, fullName: true, role: true, isActive: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return members.map((member) => this.toFrontendMember(member));
  }

  async upsertMember(user: CampaignUser, campaignId: string, dto: UpsertCampaignMemberDto) {
    const campaign = await this.findCampaignForAccess(campaignId);
    this.ensureCanManageMembers(user, campaign);
    if (dto.userId === user.id) {
      throw new BadRequestException('You are already a member of this campaign');
    }
    if (dto.userId === campaign.createdById && dto.role && dto.role !== CampaignMemberRole.OWNER) {
      throw new BadRequestException('Campaign creator must remain an owner');
    }
    const member = await this.prisma.campaignMember.upsert({
      where: { campaignId_userId: { campaignId, userId: dto.userId } },
      create: {
        campaignId,
        userId: dto.userId,
        role: dto.role ?? CampaignMemberRole.VIEWER,
        addedById: user.id,
      },
      update: {
        role: dto.role ?? CampaignMemberRole.VIEWER,
      },
      include: { user: { select: { id: true, email: true, fullName: true, role: true, isActive: true } } },
    });
    return this.toFrontendMember(member);
  }

  async updateMember(user: CampaignUser, campaignId: string, memberId: string, dto: UpdateCampaignMemberDto) {
    const campaign = await this.findCampaignForAccess(campaignId);
    this.ensureCanManageMembers(user, campaign);
    const member = await this.prisma.campaignMember.findFirst({ where: { id: memberId, campaignId } });
    if (!member) throw new NotFoundException('Campaign member not found');
    if (member.userId === campaign.createdById && dto.role !== CampaignMemberRole.OWNER) {
      throw new BadRequestException('Campaign creator must remain an owner');
    }
    const updated = await this.prisma.campaignMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: { user: { select: { id: true, email: true, fullName: true, role: true, isActive: true } } },
    });
    return this.toFrontendMember(updated);
  }

  async removeMember(user: CampaignUser, campaignId: string, memberId: string) {
    const campaign = await this.findCampaignForAccess(campaignId);
    this.ensureCanManageMembers(user, campaign);
    const member = await this.prisma.campaignMember.findFirst({ where: { id: memberId, campaignId } });
    if (!member) throw new NotFoundException('Campaign member not found');
    if (member.userId === campaign.createdById) throw new BadRequestException('Campaign creator cannot be removed');
    await this.prisma.campaignMember.delete({ where: { id: memberId } });
    return { id: memberId };
  }

  async findPublicApplicationForm(publicToken: string) {
    const form = await this.prisma.applicationForm.findUnique({
      where: { publicToken },
      include: {
        campaign: {
          include: {
            campaignPositions: {
              where: { status: 'OPEN' },
              include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } } },
            },
          },
        },
      },
    });
    if (!form || !form.isPublic || form.campaign.status !== 'ACTIVE' || form.campaign.deadline < new Date()) {
      throw new NotFoundException('Application form is not available');
    }

    return {
      id: form.id,
      publicToken: form.publicToken,
      enabledFields: form.enabledFields,
      campaign: {
        id: form.campaign.id,
        title: form.campaign.title,
        description: form.campaign.description,
        department: form.campaign.department,
        deadline: form.campaign.deadline.toISOString(),
      },
      positions: form.campaign.campaignPositions.map((campaignPosition) => ({
        id: campaignPosition.id,
        vacancies: campaignPosition.vacancies,
        title: campaignPosition.position.title,
        department: campaignPosition.position.department,
        seniority: campaignPosition.position.seniority,
        employmentType: campaignPosition.position.employmentType,
        overview: campaignPosition.position.jobDescription?.overview,
        responsibilities: campaignPosition.position.jobDescription?.responsibilities,
        requirements: campaignPosition.position.jobDescription?.requirements,
        benefits: campaignPosition.position.jobDescription?.benefits,
        skills: campaignPosition.position.positionSkills.map((positionSkill) => positionSkill.skill.name),
      })),
    };
  }

  private campaignAccessWhere(user: CampaignUser) {
    if (this.isAdmin(user)) return {};
    return {
      OR: [
        { createdById: user.id },
        { members: { some: { userId: user.id } } },
      ],
    };
  }

  private async findCampaignForAccess(id: string) {
    const campaign = await this.prisma.recruitmentCampaign.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private ensureCanView(user: CampaignUser, campaign: any) {
    if (this.isAdmin(user)) return;
    if (campaign.createdById === user.id) return;
    if (campaign.members?.some((member: any) => member.userId === user.id)) return;
    throw new ForbiddenException('You do not have access to this campaign');
  }

  private ensureCanEdit(user: CampaignUser, campaign: any) {
    if (this.isAdmin(user)) return;
    if (campaign.createdById === user.id) return;
    const membership = campaign.members?.find((member: any) => member.userId === user.id);
    if (membership?.role === CampaignMemberRole.OWNER || membership?.role === CampaignMemberRole.EDITOR) return;
    throw new ForbiddenException('You do not have edit access to this campaign');
  }

  private ensureCanManageMembers(user: CampaignUser, campaign: any) {
    if (this.isAdmin(user)) return;
    if (campaign.createdById === user.id) return;
    const membership = campaign.members?.find((member: any) => member.userId === user.id);
    if (membership?.role === CampaignMemberRole.OWNER) return;
    throw new ForbiddenException('Only campaign owners can manage members');
  }

  private isAdmin(user: CampaignUser) {
    return user.role === UserRole.ADMIN || user.role === 'admin';
  }

  private normalizeCreatePositions(dto: CreateCampaignDto): CreateCampaignPositionDto[] {
    if (dto.positions?.length) {
      dto.positions.forEach((position, index) => this.validateCreatePosition(position, index + 1));
      return dto.positions;
    }
    if (!dto.positionTitle || !dto.jd) {
      throw new BadRequestException('At least one campaign position is required');
    }
    return [
      {
        title: dto.positionTitle,
        department: dto.department,
        seniority: dto.seniority,
        employmentType: dto.employmentType,
        jd: dto.jd,
        skills: dto.skills,
        vacancies: dto.vacancies,
      },
    ];
  }

  private validateCreatePosition(position: CreateCampaignPositionDto, index: number) {
    if (position.positionId) return;
    if (!position.title?.trim()) throw new BadRequestException(`Position ${index} title is required`);
    if (!position.jd) throw new BadRequestException(`Position ${index} job description is required`);
  }

  private async createCampaignPosition(tx: any, campaignId: string, userId: string, positionDto: CreateCampaignPositionDto, fallbackDepartment?: string) {
    let positionId = positionDto.positionId;
    if (!positionId) {
      const position = await tx.jobPosition.create({
        data: {
          title: positionDto.title,
          department: positionDto.department ?? fallbackDepartment,
          seniority: positionDto.seniority,
          employmentType: positionDto.employmentType ?? 'FULL_TIME',
          createdById: userId,
          jobDescription: { create: positionDto.jd },
        },
      });
      positionId = position.id;

      for (const s of positionDto.skills ?? []) {
        const skill = await tx.skill.upsert({
          where: { name: s.name },
          create: { name: s.name, category: s.category },
          update: { category: s.category },
        });
        await tx.positionSkill.create({
          data: {
            positionId: position.id,
            skillId: skill.id,
            requiredLevel: SkillLevel.INTERMEDIATE,
            weight: s.weight ?? 1,
            isRequired: s.isRequired ?? true,
          },
        });
      }
    } else {
      await tx.jobPosition.findUniqueOrThrow({ where: { id: positionId } });
    }

    return tx.campaignPosition.create({
      data: {
        campaignId,
        positionId,
        vacancies: positionDto.vacancies ?? 1,
      },
    });
  }

  private toFrontendCampaign(campaign: any, user?: CampaignUser) {
    const firstPosition = campaign.campaignPositions?.[0]?.position;
    const membership = user ? campaign.members?.find((member: any) => member.userId === user.id) : undefined;
    return {
      id: campaign.id,
      name: campaign.title,
      jobPositionId: firstPosition?.id ?? campaign.campaignPositions?.[0]?.positionId ?? '',
      startDate: campaign.createdAt.toISOString(),
      endDate: campaign.deadline.toISOString(),
      status: campaign.status.toLowerCase(),
      createdBy: campaign.createdById,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      candidateCount: campaign.campaignPositions?.reduce((sum: number, cp: any) => sum + (cp.applications?.length ?? 0), 0) ?? 0,
      positionCount: campaign.campaignPositions?.length ?? 0,
      positions:
        campaign.campaignPositions?.map((campaignPosition: any) => this.toFrontendPosition(campaignPosition)) ?? [],
      publicApplicationToken: campaign.applicationForm?.publicToken,
      publicApplicationUrl: campaign.applicationForm?.publicToken ? `/apply/${campaign.applicationForm.publicToken}` : undefined,
      memberRole: campaign.createdById === user?.id ? 'owner' : membership?.role?.toLowerCase(),
      members: campaign.members?.map((member: any) => this.toFrontendMember(member)) ?? [],
    };
  }

  private toFrontendMember(member: any) {
    return {
      id: member.id,
      userId: member.userId,
      role: member.role.toLowerCase(),
      user: member.user
        ? {
            id: member.user.id,
            email: member.user.email,
            name: member.user.fullName,
            role: member.user.role.toLowerCase(),
            isActive: member.user.isActive,
          }
        : undefined,
    };
  }

  private toFrontendPosition(campaignPosition: any) {
    return {
      id: campaignPosition.id,
      positionId: campaignPosition.positionId,
      title: campaignPosition.position?.title ?? '',
      department: campaignPosition.position?.department,
      seniority: campaignPosition.position?.seniority,
      employmentType: campaignPosition.position?.employmentType?.toLowerCase(),
      vacancies: campaignPosition.vacancies,
      candidateCount: campaignPosition.applications?.length ?? 0,
      overview: campaignPosition.position?.jobDescription?.overview,
      responsibilities: campaignPosition.position?.jobDescription?.responsibilities,
      requirements: campaignPosition.position?.jobDescription?.requirements,
      benefits: campaignPosition.position?.jobDescription?.benefits,
      skills: campaignPosition.position?.positionSkills?.map((positionSkill: any) => positionSkill.skill.name) ?? [],
    };
  }
}
