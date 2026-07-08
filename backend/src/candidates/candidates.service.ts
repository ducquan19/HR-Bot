import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import { ApplicationStage, CampaignMemberRole, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { CV_QUEUE } from '../queue/queue.module';
import { AiService } from '../ai/ai.service';
import { CandidateQueryDto, ScoreCandidatesDto, UploadCandidateDto } from './dto/candidate.dto';
import { buildCandidateReportPdf, pdfHeading, pdfSection, pdfWrapped } from './candidate-report-pdf';

type CandidateUser = { id: string; role: string };

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
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
    if (query.stage || query.scoreMin !== undefined || query.scoreMax !== undefined) {
      where.applications = { some: {} };
      if (query.stage) where.applications.some.currentStage = query.stage;
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

    const candidate = await this.upsertCandidate(dto);
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
      include: {
        cv: { include: { aiExtractions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        campaignPosition: { include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } } } },
      },
    });

    const results = [];
    for (const app of applications) {
      const parsed = app.cv.aiExtractions[0]?.parsedJson as any;
      if (!parsed) continue;
      const result = await this.ai.screenCandidate({ parsedCv: parsed, jd: app.campaignPosition.position.jobDescription, positionSkills: app.campaignPosition.position.positionSkills });
      results.push(await this.prisma.screeningResult.upsert({ where: { applicationId: app.id }, create: { applicationId: app.id, ...result }, update: result }));
    }
    return { count: results.length, results };
  }

  async getCvDownloadUrl(user: CandidateUser, candidateId: string, cvId: string) {
    await this.findOne(user, candidateId);
    const cv = await this.prisma.cv.findFirstOrThrow({ where: { id: cvId, candidateProfileId: candidateId } });
    return { url: await this.storage.getSignedDownloadUrl(cv.storagePath) };
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
    const experiences = profile.experiences.map((item) => [item.title, item.company, item.years ? `${item.years} years` : undefined].filter(Boolean).join(' - '));
    const name = `${profile.firstName} ${profile.lastName}`;

    const lines = [
      pdfHeading('HR Bot Candidate Evaluation Report'),
      ...pdfWrapped(`Candidate: ${name}`),
      ...pdfWrapped(`Email: ${profile.email}`),
      ...pdfWrapped(`Phone: ${profile.phone ?? 'N/A'}`),
      ...pdfWrapped(`Generated at: ${new Date().toISOString()}`),
      pdfSection('Application'),
      ...pdfWrapped(`Campaign: ${app?.campaignPosition.campaign.title ?? 'N/A'}`),
      ...pdfWrapped(`Position: ${app?.campaignPosition.position.title ?? 'N/A'}`),
      ...pdfWrapped(`Stage: ${app?.currentStage ?? 'N/A'}`),
      ...pdfWrapped(`Applied at: ${app?.appliedAt?.toISOString() ?? 'N/A'}`),
      pdfSection('Profile Summary'),
      ...pdfWrapped(parsed?.summary ?? extraction?.summary ?? 'No CV summary has been extracted yet.'),
      pdfSection('Skills'),
      ...pdfWrapped(skills.length ? skills.join(', ') : 'No skills recorded.'),
      pdfSection('Education'),
      ...pdfWrapped(education.length ? education.join('; ') : 'No education recorded.'),
      pdfSection('Experience'),
      ...pdfWrapped(experiences.length ? experiences.join('; ') : `${parsed?.experienceYears ?? 0} years from CV extraction.`),
      pdfSection('AI Screening'),
      ...pdfWrapped(`Overall score: ${screening ? Math.round(screening.overallScore) : 'N/A'}%`),
      ...pdfWrapped(`Skill score: ${screening ? Math.round(screening.skillScore) : 'N/A'}%`),
      ...pdfWrapped(`Education score: ${screening ? Math.round(screening.educationScore) : 'N/A'}%`),
      ...pdfWrapped(`Experience score: ${screening ? Math.round(screening.experienceScore) : 'N/A'}%`),
      ...pdfWrapped(`Recommendation: ${screening?.recommendation ?? 'N/A'}`),
      ...pdfWrapped(screening?.explanation ?? 'No AI screening explanation has been generated yet.'),
      ...pdfWrapped(screening?.strengths?.length ? screening.strengths.join('; ') : 'No strengths recorded.', 'Strengths: '),
      ...pdfWrapped(screening?.weaknesses?.length ? screening.weaknesses.join('; ') : 'No weaknesses recorded.', 'Weaknesses: '),
      ...pdfWrapped(screening?.missingSkills?.length ? screening.missingSkills.join(', ') : 'No missing skills recorded.', 'Missing skills: '),
      pdfSection('Latest Virtual Interview'),
      ...pdfWrapped(`Status: ${interview?.status ?? 'N/A'}`),
      ...pdfWrapped(`Scheduled at: ${interview?.scheduledAt?.toISOString() ?? 'N/A'}`),
      ...pdfWrapped(
        interview?.questions?.length
          ? interview.questions.map((question: any) => `Q${question.order}: ${question.question} Answer: ${question.answer?.answer ?? 'No answer'}`).join(' | ')
          : 'No virtual interview answers recorded.',
      ),
    ];

    return {
      filename: `${this.slugify(name)}-evaluation-report.pdf`,
      buffer: buildCandidateReportPdf(lines),
    };
  }

  private async upsertCandidate(dto: UploadCandidateDto) {
    const existing = await this.prisma.candidateProfile.findFirst({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      return this.prisma.candidateProfile.update({
        where: { id: existing.id },
        data: { firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone, github: dto.github, portfolio: dto.portfolio },
      });
    }
    return this.prisma.candidateProfile.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        github: dto.github,
        portfolio: dto.portfolio,
      },
    });
  }

  private async resolveCampaignPosition(dto: UploadCandidateDto) {
    if (dto.campaignPositionId) return dto.campaignPositionId;
    if (!dto.campaignId) return undefined;
    const cp = await this.prisma.campaignPosition.findFirst({ where: { campaignId: dto.campaignId, status: 'OPEN' } });
    return cp?.id;
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

  private includeCandidate() {
    return {
      skills: { include: { skill: true } },
      education: true,
      experiences: true,
      cvs: { orderBy: { createdAt: 'desc' as const }, take: 1, include: { aiExtractions: { orderBy: { createdAt: 'desc' as const }, take: 1 } } },
      applications: {
        orderBy: { appliedAt: 'desc' as const },
        include: { screeningResult: true, campaignPosition: { include: { campaign: { include: { members: true } } } } },
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
      stage: (app?.currentStage ?? 'APPLIED').toLowerCase(),
      score,
      skills: profile.skills?.map((s: any) => s.skill.name) ?? [],
      education: profile.education?.map((e: any) => e.degree ?? e.school) ?? [],
      gpa: profile.education?.find((e: any) => e.gpa)?.gpa,
      experience: profile.experiences?.reduce((sum: number, e: any) => sum + (e.years ?? 0), 0) ?? (extraction?.parsedJson as any)?.experienceYears ?? 0,
      campaignId: app?.campaignPosition?.campaignId,
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
