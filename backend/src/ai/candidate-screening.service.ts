import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, ParsedCv } from './ai.service';

@Injectable()
export class CandidateScreeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async screenApplication(applicationId: string, parsedCv?: ParsedCv) {
    const application = await this.prisma.candidateApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: {
        cv: { include: { aiExtractions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        campaignPosition: { include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } } } },
      },
    });

    const parsed = parsedCv ?? (application.cv.aiExtractions[0]?.parsedJson as unknown as ParsedCv | undefined);
    if (!parsed) {
      throw new Error(`Cannot screen application ${applicationId}: no parsed CV extraction is available`);
    }

    const result = await this.ai.screenCandidate({
      parsedCv: parsed,
      jd: application.campaignPosition.position.jobDescription,
      positionSkills: application.campaignPosition.position.positionSkills,
    });

    const saved = await this.prisma.$transaction(async (tx) => {
      const screeningResult = await tx.screeningResult.upsert({
        where: { applicationId },
        create: { applicationId, ...result },
        update: result,
      });
      await tx.candidateApplication.update({
        where: { id: applicationId },
        data: { currentStage: 'SCREENING' },
      });
      return screeningResult;
    });

    await this.prisma.activityLog.create({
      data: {
        action: 'AI_SCREENING_COMPLETED',
        entityType: 'candidate_application',
        entityId: applicationId,
        metadata: {
          candidateProfileId: application.candidateProfileId,
          cvId: application.cvId,
          overallScore: saved.overallScore,
          recommendation: saved.recommendation,
        } as Prisma.InputJsonValue,
      },
    });

    return saved;
  }
}
