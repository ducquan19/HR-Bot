import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, SkillLevel } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationFormDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const campaigns = await this.prisma.recruitmentCampaign.findMany({
      include: { campaignPositions: { include: { position: true, applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((c) => this.toFrontendCampaign(c));
  }

  async findOne(id: string) {
    const campaign = await this.prisma.recruitmentCampaign.findUnique({
      where: { id },
      include: {
        applicationForm: true,
        campaignPositions: {
          include: {
            position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } },
            applications: { include: { candidateProfile: true, screeningResult: true } },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async create(userId: string, dto: CreateCampaignDto) {
    const deadline = new Date(dto.deadline);
    if (deadline <= new Date()) throw new BadRequestException('Deadline must be in the future');

    const campaign = await this.prisma.$transaction(async (tx) => {
      const position = await tx.jobPosition.create({
        data: {
          title: dto.positionTitle,
          department: dto.department,
          seniority: dto.seniority,
          employmentType: dto.employmentType ?? 'FULL_TIME',
          createdById: userId,
          jobDescription: { create: dto.jd },
        },
      });

      for (const s of dto.skills ?? []) {
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

      return tx.recruitmentCampaign.create({
        data: {
          title: dto.title,
          description: dto.description,
          department: dto.department,
          deadline,
          status: dto.status ?? CampaignStatus.ACTIVE,
          createdById: userId,
          campaignPositions: {
            create: { positionId: position.id, vacancies: dto.vacancies ?? 1 },
          },
          applicationForm: {
            create: { publicToken: uuid(), isPublic: true },
          },
        },
        include: { campaignPositions: { include: { position: true, applications: true } } },
      });
    });
    return this.toFrontendCampaign(campaign);
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.deadline) data.deadline = new Date(dto.deadline);
    const campaign = await this.prisma.recruitmentCampaign.update({
      where: { id },
      data,
      include: { campaignPositions: { include: { position: true, applications: true } } },
    });
    return this.toFrontendCampaign(campaign);
  }

  async remove(id: string) {
    await this.prisma.recruitmentCampaign.delete({ where: { id } });
    return { id };
  }

  async createOrUpdateForm(campaignId: string, dto: CreateApplicationFormDto = {}) {
    const campaign = await this.prisma.recruitmentCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
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

  private toFrontendCampaign(campaign: any) {
    const firstPosition = campaign.campaignPositions?.[0]?.position;
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
    };
  }
}
