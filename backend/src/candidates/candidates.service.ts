import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import { ApplicationStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { CV_QUEUE } from '../queue/queue.module';
import { AiService } from '../ai/ai.service';
import { CandidateQueryDto, ScoreCandidatesDto, UploadCandidateDto } from './dto/candidate.dto';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
    @InjectQueue(CV_QUEUE) private readonly cvQueue: Queue,
  ) {}

  async findAll(query: CandidateQueryDto) {
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
      where,
      include: this.includeCandidate(),
      orderBy: { createdAt: 'desc' },
    });
    return profiles.map((profile) => this.toFrontendCandidate(profile));
  }

  async findOne(id: string) {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { id }, include: this.includeCandidate() });
    if (!profile) throw new NotFoundException('Candidate not found');
    return this.toFrontendCandidate(profile, true);
  }

  async upload(userId: string | undefined, dto: UploadCandidateDto, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('CV file is required');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('CV file size must not exceed 10MB');
    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are supported');
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
        uploadedById: userId,
        processingStatus: 'QUEUED',
      },
    });

    const campaignPositionId = await this.resolveCampaignPosition(dto);
    if (campaignPositionId) {
      await this.prisma.candidateApplication.upsert({
        where: { candidateProfileId_campaignPositionId: { candidateProfileId: candidate.id, campaignPositionId } },
        create: { candidateProfileId: candidate.id, campaignPositionId, cvId: cv.id, source: userId ? 'RECRUITER_UPLOAD' : 'APPLICATION_FORM' },
        update: { cvId: cv.id },
      });
    }

    await this.prisma.fileProcessingJob.create({ data: { cvId: cv.id, type: 'CV_PARSE_AND_SCREEN', status: 'QUEUED' } });
    await this.cvQueue.add('parse-and-screen', { cvId: cv.id, bufferBase64: file.buffer.toString('base64'), mimeType: file.mimetype }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    return this.findOne(candidate.id);
  }

  async updateStage(candidateId: string, stage: ApplicationStage) {
    const application = await this.prisma.candidateApplication.findFirst({ where: { candidateProfileId: candidateId }, orderBy: { appliedAt: 'desc' } });
    if (!application) throw new NotFoundException('Application not found');
    await this.prisma.candidateApplication.update({ where: { id: application.id }, data: { currentStage: stage } });
    return this.findOne(candidateId);
  }

  async score(dto: ScoreCandidatesDto) {
    const where: any = {};
    if (dto.candidateIds?.length) where.candidateProfileId = { in: dto.candidateIds };
    if (dto.campaignId) where.campaignPosition = { campaignId: dto.campaignId };
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

  async getCvDownloadUrl(candidateId: string, cvId: string) {
    const cv = await this.prisma.cv.findFirstOrThrow({ where: { id: cvId, candidateProfileId: candidateId } });
    return { url: await this.storage.getSignedDownloadUrl(cv.storagePath) };
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

  private includeCandidate() {
    return {
      skills: { include: { skill: true } },
      education: true,
      experiences: true,
      cvs: { orderBy: { createdAt: 'desc' as const }, take: 1, include: { aiExtractions: { orderBy: { createdAt: 'desc' as const }, take: 1 } } },
      applications: { orderBy: { appliedAt: 'desc' as const }, include: { screeningResult: true, campaignPosition: true } },
    };
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
