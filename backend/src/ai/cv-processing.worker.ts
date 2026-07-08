import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { CV_QUEUE } from '../queue/queue.module';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, ParsedCv } from './ai.service';
import { CandidateScreeningService } from './candidate-screening.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { StorageService } from '../files/storage.service';
import { Prisma } from '@prisma/client';

interface CvJobData {
  cvId: string;
  storagePath: string;
  mimeType: string;
}

@Processor(CV_QUEUE)
export class CvProcessingWorker extends WorkerHost {
  private readonly logger = new Logger(CvProcessingWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly screening: CandidateScreeningService,
    private readonly realtime: RealtimeGateway,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<CvJobData>) {
    const { cvId, storagePath, mimeType } = job.data;
    await this.prisma.cv.update({ where: { id: cvId }, data: { processingStatus: 'PARSING' } });
    this.realtime.emitCvProcessing(cvId, 'PARSING');

    try {
      const buffer = await this.storage.downloadBuffer(storagePath);
      const rawText = await this.extractText(buffer, mimeType);
      const parsed = await this.ai.parseCv(rawText);

      const cv = await this.prisma.cv.findUniqueOrThrow({ where: { id: cvId }, include: { applications: { include: { campaignPosition: { include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } } } } } } } });
      const extraction = await this.prisma.aiExtraction.create({
        data: {
          cvId,
          modelName: this.ai.getCvParserModelName(),
          modelVersion: '1.0',
          rawText,
          parsedJson: parsed as unknown as Prisma.InputJsonValue,
          summary: parsed.summary,
        },
      });

      await this.materializeParsedCv(cv.candidateProfileId, parsed);
      const hasEmbedding = await this.saveCandidateEmbedding(cv.candidateProfileId, cvId, parsed);

      for (const app of cv.applications) {
        await this.prisma.cv.update({ where: { id: cvId }, data: { processingStatus: 'SCREENING' } });
        await this.screening.screenApplication(app.id, parsed);
      }

      await this.prisma.cv.update({ where: { id: cvId }, data: { processingStatus: 'COMPLETED' } });
      const completedPayload = {
        candidateId: cv.candidateProfileId,
        applicationIds: cv.applications.map((app) => app.id),
        extractionId: extraction.id,
        hasEmbedding,
        completedAt: new Date().toISOString(),
      };
      await this.prisma.activityLog.create({
        data: {
          action: 'CV_PROCESSING_COMPLETED',
          entityType: 'candidate',
          entityId: cv.candidateProfileId,
          metadata: { cvId, ...completedPayload },
        },
      });
      this.realtime.emitCvProcessing(cvId, 'COMPLETED', completedPayload);
      this.realtime.emitCandidateUpdated(cv.candidateProfileId, {
        reason: 'CV_PROCESSING_COMPLETED',
        cvId,
        extractionId: extraction.id,
        hasEmbedding,
      });
      return { cvId, status: 'COMPLETED' };
    } catch (error) {
      await this.prisma.cv.update({ where: { id: cvId }, data: { processingStatus: 'FAILED', processingError: (error as Error).message } });
      const failedAt = new Date().toISOString();
      const failedCv = await this.prisma.cv.findUnique({ where: { id: cvId }, select: { candidateProfileId: true } });
      if (failedCv) {
        await this.prisma.activityLog.create({
          data: {
            action: 'CV_PROCESSING_FAILED',
            entityType: 'candidate',
            entityId: failedCv.candidateProfileId,
            metadata: { cvId, error: (error as Error).message, failedAt },
          },
        });
      }
      this.realtime.emitCvProcessing(cvId, 'FAILED', {
        candidateId: failedCv?.candidateProfileId,
        error: (error as Error).message,
        failedAt,
      });
      throw error;
    }
  }

  private async extractText(buffer: Buffer, mimeType: string) {
    if (mimeType.includes('pdf')) {
      const parsed = await pdfParse(buffer);
      return parsed.text;
    }
    if (mimeType.includes('word') || mimeType.includes('officedocument')) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    throw new Error('Unsupported CV format');
  }

  private async materializeParsedCv(candidateProfileId: string, parsed: ParsedCv) {
    await this.prisma.$transaction(async (tx) => {
      const profileUpdate = await this.buildProfileUpdate(tx, candidateProfileId, parsed);
      if (Object.keys(profileUpdate).length) {
        await tx.candidateProfile.update({ where: { id: candidateProfileId }, data: profileUpdate });
      }

      await tx.candidateEducation.deleteMany({ where: { candidateProfileId } });
      await tx.candidateSkill.deleteMany({ where: { candidateProfileId } });
      await tx.candidateExperience.deleteMany({ where: { candidateProfileId } });
      await tx.candidateProject.deleteMany({ where: { candidateProfileId } });
      await tx.candidateCertification.deleteMany({ where: { candidateProfileId } });

      for (const education of this.uniqueStrings(parsed.education)) {
        await tx.candidateEducation.create({
          data: {
            candidateProfileId,
            school: education,
            degree: education,
          },
        });
      }

      for (const skillName of this.uniqueStrings(parsed.skills)) {
        const skill = await tx.skill.upsert({ where: { name: skillName }, create: { name: skillName }, update: {} });
        await tx.candidateSkill.create({
          data: {
            candidateProfileId,
            skillId: skill.id,
          },
        });
      }

      for (const experience of parsed.experiences ?? []) {
        const company = this.cleanString(experience.company) ?? 'Unknown company';
        const title = this.cleanString(experience.title) ?? 'Unknown role';
        await tx.candidateExperience.create({
          data: {
            candidateProfileId,
            company,
            title,
            startDate: this.parseDate(experience.startDate),
            endDate: this.parseDate(experience.endDate),
            description: this.cleanString(experience.description),
            years: experience.years,
          },
        });
      }

      for (const project of this.uniqueStrings(parsed.projects)) {
        await tx.candidateProject.create({
          data: {
            candidateProfileId,
            name: this.truncate(project, 120),
            description: project,
          },
        });
      }

      for (const certification of this.uniqueStrings(parsed.certifications)) {
        await tx.candidateCertification.create({
          data: {
            candidateProfileId,
            name: certification,
          },
        });
      }
    });
  }

  private async saveCandidateEmbedding(candidateProfileId: string, cvId: string, parsed: ParsedCv) {
    const content = this.buildCandidateEmbeddingText(parsed);
    if (!content) return false;

    try {
      const embedding = await this.ai.embed(content, 'document');
      const vectorLiteral = `[${embedding.join(',')}]`;
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM candidate_embeddings
           WHERE candidate_profile_id = $1::uuid AND source_type = 'cv'`,
          candidateProfileId,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO candidate_embeddings (candidate_profile_id, source_type, source_id, content, embedding)
           VALUES ($1::uuid, 'cv', $2::uuid, $3, $4::vector)`,
          candidateProfileId,
          cvId,
          content,
          vectorLiteral,
        );
      });
      return true;
    } catch (error) {
      this.logger.warn(`Could not save candidate embedding for ${candidateProfileId}: ${(error as Error).message}`);
      return false;
    }
  }

  private buildCandidateEmbeddingText(parsed: ParsedCv) {
    const sections = [
      ['Summary', parsed.summary],
      ['Skills', this.uniqueStrings(parsed.skills).join(', ')],
      ['Education', this.uniqueStrings(parsed.education).join('; ')],
      ['Experience', (parsed.experiences ?? []).map((experience) => [experience.title, experience.company, experience.description, experience.years ? this.formatExperienceDuration(experience.years) : undefined].filter(Boolean).join(' - ')).filter(Boolean).join('; ')],
      ['Projects', this.uniqueStrings(parsed.projects).join('; ')],
      ['Certifications', this.uniqueStrings(parsed.certifications).join('; ')],
      ['Languages', this.uniqueStrings(parsed.languages).join('; ')],
    ]
      .map(([label, value]) => this.cleanString(value) ? `${label}: ${this.cleanString(value)}` : undefined)
      .filter(Boolean);
    return sections.join('\n');
  }

  private async buildProfileUpdate(tx: Prisma.TransactionClient, candidateProfileId: string, parsed: ParsedCv) {
    const update: Prisma.CandidateProfileUpdateInput = {};
    const firstName = this.cleanString(parsed.firstName);
    const lastName = this.cleanString(parsed.lastName);
    const email = this.cleanString(parsed.email)?.toLowerCase();
    const phone = this.cleanString(parsed.phone);

    if (firstName) update.firstName = firstName;
    if (lastName) update.lastName = lastName;
    if (phone) update.phone = phone;

    if (email) {
      const owner = await tx.candidateProfile.findUnique({ where: { email }, select: { id: true } });
      if (!owner || owner.id === candidateProfileId) update.email = email;
    }

    return update;
  }

  private uniqueStrings(values: string[] = []) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
      const cleaned = this.cleanString(value);
      const key = cleaned?.toLowerCase();
      if (!cleaned || !key || seen.has(key)) continue;
      seen.add(key);
      result.push(cleaned);
    }
    return result;
  }

  private cleanString(value?: string) {
    const cleaned = value?.replace(/\s+/g, ' ').trim();
    return cleaned || undefined;
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? value.slice(0, maxLength - 1).trimEnd() : value;
  }

  private parseDate(value?: string) {
    const cleaned = this.cleanString(value);
    if (!cleaned) return undefined;
    const yearMonthDay = cleaned.match(/^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?/);
    if (!yearMonthDay) return undefined;
    const year = Number(yearMonthDay[1]);
    const month = Number(yearMonthDay[2] ?? 1);
    const day = Number(yearMonthDay[3] ?? 1);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? undefined : date;
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
}
