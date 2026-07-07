import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { CV_QUEUE } from '../queue/queue.module';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Prisma } from '@prisma/client';

interface CvJobData {
  cvId: string;
  bufferBase64: string;
  mimeType: string;
}

@Processor(CV_QUEUE)
export class CvProcessingWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<CvJobData>) {
    const { cvId, bufferBase64, mimeType } = job.data;
    await this.prisma.cv.update({ where: { id: cvId }, data: { processingStatus: 'PARSING' } });
    this.realtime.emitCvProcessing(cvId, 'PARSING');

    try {
      const buffer = Buffer.from(bufferBase64, 'base64');
      const rawText = await this.extractText(buffer, mimeType);
      const parsed = await this.ai.parseCv(rawText);

      const cv = await this.prisma.cv.findUniqueOrThrow({ where: { id: cvId }, include: { applications: { include: { campaignPosition: { include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } } } } } } } });
      await this.prisma.aiExtraction.create({
        data: {
          cvId,
          modelName: 'mock-parser',
          modelVersion: '1.0',
          rawText,
          parsedJson: parsed as unknown as Prisma.InputJsonValue,
          summary: parsed.summary,
        },
      });

      await this.materializeParsedCv(cv.candidateProfileId, parsed);

      for (const app of cv.applications) {
        await this.prisma.cv.update({ where: { id: cvId }, data: { processingStatus: 'SCREENING' } });
        const result = await this.ai.screenCandidate({
          parsedCv: parsed,
          jd: app.campaignPosition.position.jobDescription,
          positionSkills: app.campaignPosition.position.positionSkills,
        });
        await this.prisma.screeningResult.upsert({
          where: { applicationId: app.id },
          create: { applicationId: app.id, ...result },
          update: result,
        });
        await this.prisma.candidateApplication.update({ where: { id: app.id }, data: { currentStage: 'SCREENING' } });
      }

      await this.prisma.cv.update({ where: { id: cvId }, data: { processingStatus: 'COMPLETED' } });
      this.realtime.emitCvProcessing(cvId, 'COMPLETED');
      return { cvId, status: 'COMPLETED' };
    } catch (error) {
      await this.prisma.cv.update({ where: { id: cvId }, data: { processingStatus: 'FAILED', processingError: (error as Error).message } });
      this.realtime.emitCvProcessing(cvId, 'FAILED', { error: (error as Error).message });
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

  private async materializeParsedCv(candidateProfileId: string, parsed: any) {
    await this.prisma.candidateEducation.deleteMany({ where: { candidateProfileId } });
    await this.prisma.candidateSkill.deleteMany({ where: { candidateProfileId } });
    for (const education of parsed.education ?? []) {
      await this.prisma.candidateEducation.create({ data: { candidateProfileId, school: education, degree: education } });
    }
    for (const skillName of parsed.skills ?? []) {
      const skill = await this.prisma.skill.upsert({ where: { name: skillName }, create: { name: skillName }, update: {} });
      await this.prisma.candidateSkill.upsert({
        where: { candidateProfileId_skillId: { candidateProfileId, skillId: skill.id } },
        create: { candidateProfileId, skillId: skill.id },
        update: {},
      });
    }
  }
}
