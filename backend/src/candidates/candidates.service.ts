import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import { ApplicationStage, CampaignMemberRole, CampaignPositionStatus, CampaignStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { CV_QUEUE } from '../queue/queue.module';
import { CandidateScreeningService } from '../ai/candidate-screening.service';
import { SearchService } from '../search/search.service';
import { CandidateQueryDto, CandidateSearchDto, ScoreCandidatesDto, UploadCandidateDto } from './dto/candidate.dto';
import { buildCandidateReportPdf, pdfBullets, pdfField, pdfHeading, pdfParagraph, pdfSection } from './candidate-report-pdf';

type CandidateUser = { id: string; role: string };

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly screening: CandidateScreeningService,
    private readonly searchService: SearchService,
    @InjectQueue(CV_QUEUE) private readonly cvQueue: Queue,
  ) {}

  async findAll(user: CandidateUser, query: CandidateQueryDto) {
    const where: any = {};
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.skill) {
      where.skills = { some: { skill: { name: { contains: query.skill, mode: 'insensitive' } } } };
    }
    if (query.stage || query.scoreMin !== undefined || query.scoreMax !== undefined || query.campaignId) {
      where.applications = { some: {} };
      if (query.stage) where.applications.some.currentStage = query.stage;
      if (query.campaignId) where.applications.some.campaignPosition = { campaignId: query.campaignId };
      if (query.scoreMin !== undefined || query.scoreMax !== undefined) {
        where.applications.some.screeningResult = {
          overallScore: {
            gte: query.scoreMin !== undefined ? query.scoreMin * 100 : undefined,
            lte: query.scoreMax !== undefined ? query.scoreMax * 100 : undefined,
          },
        };
      }
    }

    const profiles = await this.prisma.candidateProfile.findMany({
      where: this.withCandidateAccess(user, where),
      include: this.includeCandidate(),
      orderBy: { createdAt: 'desc' },
    });
    return profiles.map((profile) => this.toFrontendCandidate(profile));
  }

  async search(dto: CandidateSearchDto) {
    const limit = Math.min(Math.max(dto.limit ?? 50, 1), 100);
    if (dto.mode === 'semantic') {
      return this.searchService.semanticCandidates(dto.query ?? '', limit);
    }

    const where: any = {};
    const and: any[] = [];

    if (dto.name?.trim()) {
      const name = dto.name.trim();
      and.push({
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
          { email: { contains: name, mode: 'insensitive' } },
        ],
      });
    }

    if (dto.education?.trim()) {
      const education = dto.education.trim();
      and.push({
        education: {
          some: {
            OR: [
              { school: { contains: education, mode: 'insensitive' } },
              { degree: { contains: education, mode: 'insensitive' } },
              { field: { contains: education, mode: 'insensitive' } },
            ],
          },
        },
      });
    }

    const skillTerms = this.uniqueStrings([...(dto.skills ?? []), dto.skill].filter(Boolean) as string[]);
    if (skillTerms.length) {
      if (dto.skillOperator === 'and') {
        and.push(...skillTerms.map((skill) => ({
          skills: { some: { skill: { name: { contains: skill, mode: 'insensitive' } } } },
        })));
      } else {
        and.push({
          OR: skillTerms.map((skill) => ({
            skills: { some: { skill: { name: { contains: skill, mode: 'insensitive' } } } },
          })),
        });
      }
    }

    if (dto.stage || dto.scoreMin !== undefined || dto.scoreMax !== undefined || dto.campaignId) {
      const applicationFilter: any = {};
      if (dto.stage) applicationFilter.currentStage = dto.stage;
      if (dto.campaignId) applicationFilter.campaignPosition = { campaignId: dto.campaignId };
      if (dto.scoreMin !== undefined || dto.scoreMax !== undefined) {
        applicationFilter.screeningResult = {
          overallScore: {
            gte: dto.scoreMin !== undefined ? this.toScorePercent(dto.scoreMin) : undefined,
            lte: dto.scoreMax !== undefined ? this.toScorePercent(dto.scoreMax) : undefined,
          },
        };
      }
      and.push({ applications: { some: applicationFilter } });
    }

    if (and.length) where.AND = and;

    const profiles = await this.prisma.candidateProfile.findMany({
      where,
      include: this.includeCandidate(),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return profiles
      .map((profile) => this.toFrontendCandidate(profile))
      .filter((candidate) => this.matchesExperience(candidate.experience, dto.experienceMin, dto.experienceMax));
  }

  async findOne(user: CandidateUser, id: string) {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { id }, include: this.includeCandidate() });
    if (!profile) throw new NotFoundException('Candidate not found');
    this.ensureCanAccessCandidate(user, profile);
    return this.toFrontendCandidate(profile, true);
  }

  async upload(user: CandidateUser | undefined, dto: UploadCandidateDto, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('CV file is required');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('CV file size must not exceed 10MB');
    if (!this.isSupportedCvFile(file)) {
      throw new BadRequestException('Only PDF and DOCX files are supported');
    }

    const campaignPositionId = await this.resolveCampaignPosition(dto);
    if (user && campaignPositionId) {
      await this.ensureCanEditCampaignPosition(user, campaignPositionId);
    }

    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const key = `cvs/${new Date().getFullYear()}/${checksum}-${file.originalname}`;
    await this.storage.uploadBuffer(key, file.buffer, file.mimetype);

    const candidate = await this.upsertCandidate(dto, checksum, file.originalname, Boolean(user));
    const cv = await this.prisma.cv.create({
      data: {
        candidateProfileId: candidate.id,
        originalFilename: file.originalname,
        storagePath: key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksum,
        uploadedById: user?.id,
        processingStatus: 'QUEUED',
      },
    });

    if (campaignPositionId) {
      await this.prisma.candidateApplication.upsert({
        where: { candidateProfileId_campaignPositionId: { candidateProfileId: candidate.id, campaignPositionId } },
        create: { candidateProfileId: candidate.id, campaignPositionId, cvId: cv.id, source: user ? 'RECRUITER_UPLOAD' : 'APPLICATION_FORM' },
        update: { cvId: cv.id },
      });
    }

    await this.prisma.fileProcessingJob.create({ data: { cvId: cv.id, type: 'CV_PARSE_AND_SCREEN', status: 'QUEUED' } });
    await this.cvQueue.add('parse-and-screen', { cvId: cv.id, storagePath: key, mimeType: file.mimetype }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    if (!user) {
      return this.toFrontendCandidate(await this.prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidate.id }, include: this.includeCandidate() }), true);
    }
    return this.findOne(user, candidate.id);
  }

  async updateStage(user: CandidateUser, candidateId: string, stage: ApplicationStage) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: { candidateProfileId: candidateId },
      orderBy: { appliedAt: 'desc' },
      include: { campaignPosition: { include: { campaign: { include: { members: true } } } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    this.ensureCanEditCampaign(user, application.campaignPosition.campaign);
    await this.prisma.candidateApplication.update({ where: { id: application.id }, data: { currentStage: stage } });
    return this.findOne(user, candidateId);
  }

  async remove(user: CandidateUser, candidateId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        cvs: { select: { id: true, storagePath: true, uploadedById: true } },
        applications: {
          include: {
            campaignPosition: {
              include: {
                campaign: { include: { members: true } },
              },
            },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Candidate not found');
    this.ensureCanDeleteCandidate(user, profile);

    const storagePaths = profile.cvs.map((cv) => cv.storagePath).filter(Boolean);
    await this.prisma.$transaction(async (tx) => {
      await tx.candidateProfile.delete({ where: { id: candidateId } });
      await tx.activityLog.create({
        data: {
          action: 'CANDIDATE_DELETED',
          entityType: 'candidate',
          entityId: candidateId,
          metadata: {
            email: profile.email,
            cvIds: profile.cvs.map((cv) => cv.id),
            applicationIds: profile.applications.map((app) => app.id),
          },
        },
      });
    });

    await Promise.all(storagePaths.map(async (storagePath) => {
      try {
        await this.storage.deleteObject(storagePath);
      } catch (error) {
        this.logger.warn(`Could not delete CV object ${storagePath}: ${(error as Error).message}`);
      }
    }));

    return { id: candidateId };
  }

  async score(user: CandidateUser, dto: ScoreCandidatesDto) {
    const where: any = {};
    if (dto.candidateIds?.length) where.candidateProfileId = { in: dto.candidateIds };
    if (dto.campaignId) {
      where.campaignPosition = {
        campaignId: dto.campaignId,
        campaign: this.withCampaignEditAccess(user),
      };
    } else {
      where.campaignPosition = {
        campaign: this.withCampaignEditAccess(user),
      };
    }
    const applications = await this.prisma.candidateApplication.findMany({
      where,
      select: { id: true },
    });

    const results = [];
    for (const app of applications) {
      try {
        results.push(await this.screening.screenApplication(app.id));
      } catch (error) {
        if (!String((error as Error).message).includes('no parsed CV extraction')) throw error;
      }
    }
    return { count: results.length, results };
  }

  async getCvDownloadUrl(user: CandidateUser, candidateId: string, cvId: string) {
    await this.findOne(user, candidateId);
    const cv = await this.prisma.cv.findFirstOrThrow({ where: { id: cvId, candidateProfileId: candidateId } });
    return { url: await this.storage.getSignedDownloadUrl(cv.storagePath) };
  }

  async getLatestCvDownloadUrl(user: CandidateUser, candidateId: string) {
    await this.findOne(user, candidateId);
    const cv = await this.prisma.cv.findFirst({
      where: { candidateProfileId: candidateId },
      orderBy: { createdAt: 'desc' },
      select: { storagePath: true, originalFilename: true },
    });
    if (!cv) throw new NotFoundException('CV not found');
    return {
      url: await this.storage.getSignedDownloadUrl(cv.storagePath),
      filename: cv.originalFilename,
    };
  }

  async generateReportPdf(user: CandidateUser, candidateId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        skills: { include: { skill: true } },
        education: true,
        experiences: true,
        cvs: { orderBy: { createdAt: 'desc' }, take: 1, include: { aiExtractions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        applications: {
          orderBy: { appliedAt: 'desc' },
          include: {
            screeningResult: true,
            campaignPosition: { include: { campaign: { include: { members: true } }, position: { include: { jobDescription: true } } } },
            interviewSessions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { questions: { orderBy: { order: 'asc' }, include: { answer: true } } },
            },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Candidate not found');
    this.ensureCanAccessCandidate(user, profile);

    const app = profile.applications[0];
    const screening = app?.screeningResult;
    const extraction = profile.cvs[0]?.aiExtractions[0];
    const parsed = extraction?.parsedJson as any;
    const interview = app?.interviewSessions[0];
    const skills = profile.skills.map((item) => item.skill.name);
    const education = profile.education.map((item) => [item.degree, item.school].filter(Boolean).join(' - '));
    const experiences = profile.experiences.map((item) => [item.title, item.company, item.years ? this.formatExperienceDuration(item.years) : undefined].filter(Boolean).join(' - '));
    const name = `${profile.firstName} ${profile.lastName}`;
    const interviewQuestions = interview?.questions?.map((question: any) => (
      `Q${question.order}: ${question.question} Answer: ${question.answer?.answer ?? 'No answer'}`
    )) ?? [];

    const lines = [
      pdfHeading('HR Bot Candidate Evaluation Report'),
      ...pdfField('Candidate', name),
      ...pdfField('Email', profile.email),
      ...pdfField('Phone', profile.phone ?? 'N/A'),
      ...pdfField('Generated at', new Date().toISOString()),
      pdfSection('Application'),
      ...pdfField('Campaign', app?.campaignPosition.campaign.title ?? 'N/A'),
      ...pdfField('Position', app?.campaignPosition.position.title ?? 'N/A'),
      ...pdfField('Stage', app?.currentStage ?? 'N/A'),
      ...pdfField('Applied at', app?.appliedAt?.toISOString() ?? 'N/A'),
      pdfSection('Profile Summary'),
      ...pdfParagraph(parsed?.summary ?? extraction?.summary ?? 'No CV summary has been extracted yet.'),
      pdfSection('Skills'),
      ...pdfBullets(skills, 'No skills recorded.'),
      pdfSection('Education'),
      ...pdfBullets(education, 'No education recorded.'),
      pdfSection('Experience'),
      ...pdfBullets(experiences.length ? experiences : [`${this.formatExperienceDuration(parsed?.experienceYears ?? 0)} from CV extraction.`], 'No experience recorded.'),
      pdfSection('AI Screening'),
      ...pdfField('Overall score', screening ? `${Math.round(screening.overallScore)}%` : 'N/A'),
      ...pdfField('Skill score', screening ? `${Math.round(screening.skillScore)}%` : 'N/A'),
      ...pdfField('Education score', screening ? `${Math.round(screening.educationScore)}%` : 'N/A'),
      ...pdfField('Experience score', screening ? `${Math.round(screening.experienceScore)}%` : 'N/A'),
      ...pdfField('Recommendation', screening?.recommendation ?? 'N/A'),
      pdfSection('AI Explanation'),
      ...pdfParagraph(screening?.explanation ?? 'No AI screening explanation has been generated yet.'),
      pdfSection('Strengths'),
      ...pdfBullets(screening?.strengths ?? [], 'No strengths recorded.'),
      pdfSection('Weaknesses'),
      ...pdfBullets(screening?.weaknesses ?? [], 'No weaknesses recorded.'),
      pdfSection('Missing Skills'),
      ...pdfBullets(screening?.missingSkills ?? [], 'No missing skills recorded.'),
      pdfSection('Latest Virtual Interview'),
      ...pdfField('Status', interview?.status ?? 'N/A'),
      ...pdfField('Scheduled at', interview?.scheduledAt?.toISOString() ?? 'N/A'),
      ...pdfBullets(interviewQuestions, 'No virtual interview answers recorded.'),
    ];

    return {
      filename: `${this.slugify(name)}-evaluation-report.pdf`,
      buffer: buildCandidateReportPdf(lines),
    };
  }

  private async upsertCandidate(dto: UploadCandidateDto, checksum: string, originalFilename: string, isInternalUpload: boolean) {
    if (!isInternalUpload && (!dto.firstName || !dto.lastName || !dto.email)) {
      throw new BadRequestException('firstName, lastName and email are required');
    }

    const email = dto.email?.trim().toLowerCase() || `candidate-${checksum.slice(0, 16)}@upload.hrbot.local`;
    const existing = await this.prisma.candidateProfile.findFirst({ where: { email } });
    if (existing) {
      return this.prisma.candidateProfile.update({
        where: { id: existing.id },
        data: {
          firstName: dto.firstName?.trim() || existing.firstName,
          lastName: dto.lastName?.trim() || existing.lastName,
          phone: dto.phone,
          github: dto.github,
          portfolio: dto.portfolio,
        },
      });
    }
    const fallbackName = this.filenameToCandidateName(originalFilename);
    return this.prisma.candidateProfile.create({
      data: {
        firstName: dto.firstName?.trim() || fallbackName.firstName,
        lastName: dto.lastName?.trim() || fallbackName.lastName,
        email,
        phone: dto.phone,
        github: dto.github,
        portfolio: dto.portfolio,
      },
    });
  }

  private filenameToCandidateName(filename: string) {
    const baseName = filename
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!baseName) return { firstName: 'Pending', lastName: 'Candidate' };
    const [firstName, ...rest] = baseName.split(' ');
    return {
      firstName: firstName || 'Pending',
      lastName: rest.join(' ') || 'Candidate',
    };
  }

  private async resolveCampaignPosition(dto: UploadCandidateDto) {
    if (dto.campaignPositionId) {
      const campaignPosition = await this.prisma.campaignPosition.findUnique({
        where: { id: dto.campaignPositionId },
        include: { campaign: true },
      });
      if (!campaignPosition) throw new NotFoundException('Campaign position not found');
      if (campaignPosition.status !== CampaignPositionStatus.OPEN || campaignPosition.campaign.status !== CampaignStatus.ACTIVE) {
        throw new BadRequestException('Campaign is not active or has no open positions');
      }
      return campaignPosition.id;
    }
    if (!dto.campaignId) return undefined;
    const cp = await this.prisma.campaignPosition.findFirst({
      where: {
        campaignId: dto.campaignId,
        status: CampaignPositionStatus.OPEN,
        campaign: { status: CampaignStatus.ACTIVE },
      },
    });
    if (!cp) throw new BadRequestException('Campaign is not active or has no open positions');
    return cp.id;
  }

  private isSupportedCvFile(file: Express.Multer.File) {
    const filename = file.originalname.toLowerCase();
    const supportedMimeTypes = [
      'application/pdf',
      'application/x-pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ];
    return supportedMimeTypes.includes(file.mimetype) && (filename.endsWith('.pdf') || filename.endsWith('.docx'));
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'candidate';
  }

  private toScorePercent(value: number) {
    return value <= 1 ? value * 100 : value;
  }

  private uniqueStrings(values: string[]) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
      const cleaned = value.trim();
      const key = cleaned.toLowerCase();
      if (!cleaned || seen.has(key)) continue;
      seen.add(key);
      result.push(cleaned);
    }
    return result;
  }

  private matchesExperience(experience: number, min?: number, max?: number) {
    if (min !== undefined && experience < min) return false;
    if (max !== undefined && experience > max) return false;
    return true;
  }

  private formatExperienceDuration(years?: number) {
    if (!years || Number.isNaN(years) || years <= 0) return '0 months';
    const totalMonths = Math.round(years * 12);
    const wholeYears = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const parts = [];
    if (wholeYears) parts.push(`${wholeYears} ${wholeYears === 1 ? 'year' : 'years'}`);
    if (months) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
    return parts.join(' ') || '0 months';
  }

  private includeCandidate() {
    return {
      skills: { include: { skill: true } },
      education: true,
      experiences: true,
      cvs: { orderBy: { createdAt: 'desc' as const }, take: 1, include: { aiExtractions: { orderBy: { createdAt: 'desc' as const }, take: 1 } } },
      applications: {
        orderBy: { appliedAt: 'desc' as const },
        include: { screeningResult: true, campaignPosition: { include: { campaign: { include: { members: true } }, position: true } } },
      },
    };
  }

  private withCandidateAccess(user: CandidateUser, where: any = {}) {
    if (this.isAdmin(user)) return where;
    return {
      AND: [
        where,
        {
          OR: [
            { cvs: { some: { uploadedById: user.id } } },
            {
              applications: {
                some: {
                  campaignPosition: {
                    campaign: {
                      OR: [{ createdById: user.id }, { members: { some: { userId: user.id } } }],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    };
  }

  private withCampaignEditAccess(user: CandidateUser) {
    if (this.isAdmin(user)) return {};
    return {
      OR: [
        { createdById: user.id },
        { members: { some: { userId: user.id, role: { in: [CampaignMemberRole.OWNER, CampaignMemberRole.EDITOR] } } } },
      ],
    };
  }

  private ensureCanAccessCandidate(user: CandidateUser, profile: any) {
    if (this.isAdmin(user)) return;
    const uploadedByUser = profile.cvs?.some((cv: any) => cv.uploadedById === user.id);
    const campaignMember = profile.applications?.some((app: any) => {
      const campaign = app.campaignPosition?.campaign;
      return campaign?.createdById === user.id || campaign?.members?.some((member: any) => member.userId === user.id);
    });
    if (!uploadedByUser && !campaignMember) {
      throw new ForbiddenException('You do not have access to this candidate');
    }
  }

  private ensureCanDeleteCandidate(user: CandidateUser, profile: any) {
    if (this.isAdmin(user)) return;
    const uploadedByUser = profile.cvs?.some((cv: any) => cv.uploadedById === user.id);
    const campaignEditor = profile.applications?.some((app: any) => {
      const campaign = app.campaignPosition?.campaign;
      return campaign?.createdById === user.id || campaign?.members?.some((member: any) => (
        member.userId === user.id && [CampaignMemberRole.OWNER, CampaignMemberRole.EDITOR].includes(member.role)
      ));
    });
    if (!uploadedByUser && !campaignEditor) {
      throw new ForbiddenException('You do not have permission to delete this candidate');
    }
  }

  private async ensureCanEditCampaignPosition(user: CandidateUser, campaignPositionId: string) {
    const campaignPosition = await this.prisma.campaignPosition.findUnique({
      where: { id: campaignPositionId },
      include: { campaign: { include: { members: true } } },
    });
    if (!campaignPosition) throw new NotFoundException('Campaign position not found');
    this.ensureCanEditCampaign(user, campaignPosition.campaign);
  }

  private ensureCanEditCampaign(user: CandidateUser, campaign: any) {
    if (this.isAdmin(user)) return;
    const canEdit =
      campaign.createdById === user.id ||
      campaign.members?.some((member: any) => member.userId === user.id && [CampaignMemberRole.OWNER, CampaignMemberRole.EDITOR].includes(member.role));
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to modify this campaign');
    }
  }

  private isAdmin(user: CandidateUser) {
    return user.role === UserRole.ADMIN || user.role === 'admin';
  }

  private toFrontendCandidate(profile: any, detailed = false) {
    const app = profile.applications?.[0];
    const cv = profile.cvs?.[0];
    const extraction = cv?.aiExtractions?.[0];
    const score = app?.screeningResult?.overallScore !== undefined ? app.screeningResult.overallScore / 100 : undefined;
    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone ?? '',
      cvUrl: cv ? `/api/candidates/${profile.id}/cv/${cv.id}/download` : '',
      cvProcessingStatus: cv?.processingStatus?.toLowerCase(),
      cvProcessingError: cv?.processingError,
      stage: (app?.currentStage ?? 'APPLIED').toLowerCase(),
      score,
      skills: profile.skills?.map((s: any) => s.skill.name) ?? [],
      education: profile.education?.map((e: any) => e.degree ?? e.school) ?? [],
      gpa: profile.education?.find((e: any) => e.gpa)?.gpa,
      experience: profile.experiences?.reduce((sum: number, e: any) => sum + (e.years ?? 0), 0) ?? (extraction?.parsedJson as any)?.experienceYears ?? 0,
      campaignId: app?.campaignPosition?.campaignId,
      campaignName: app?.campaignPosition?.campaign?.title,
      positionName: app?.campaignPosition?.position?.title,
      applicationId: app?.id,
      appliedAt: app?.appliedAt?.toISOString() ?? profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      extractedInfo: detailed ? extraction?.parsedJson : undefined,
      screeningResult: app?.screeningResult
        ? {
            overallScore: app.screeningResult.overallScore,
            skillScore: app.screeningResult.skillScore,
            educationScore: app.screeningResult.educationScore,
            experienceScore: app.screeningResult.experienceScore,
            recommendation: app.screeningResult.recommendation.toLowerCase(),
            strengths: app.screeningResult.strengths ?? [],
            weaknesses: app.screeningResult.weaknesses ?? [],
            missingSkills: app.screeningResult.missingSkills ?? [],
            explanation: app.screeningResult.explanation,
            updatedAt: app.screeningResult.updatedAt?.toISOString(),
          }
        : undefined,
    };
  }
}
