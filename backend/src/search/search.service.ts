import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService, private readonly ai: AiService) {}

  async semanticCandidates(query: string, limit = 20) {
    if (!query?.trim()) return [];
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const embedding = await this.ai.embed(query, 'query');
    const vectorLiteral = `[${embedding.join(',')}]`;

    try {
      const matches = await this.prisma.$queryRawUnsafe<Array<{ id: string; similarity: number }>>(
        `SELECT ce.candidate_profile_id AS id, 1 - MIN(ce.embedding <=> $1::vector) AS similarity
         FROM candidate_embeddings ce
         GROUP BY ce.candidate_profile_id
         ORDER BY MIN(ce.embedding <=> $1::vector)
         LIMIT $2`,
        vectorLiteral,
        safeLimit,
      );

      if (!matches.length) return [];

      const similarityById = new Map(matches.map((match) => [match.id, Number(match.similarity)]));
      const orderById = new Map(matches.map((match, index) => [match.id, index]));
      const profiles = await this.prisma.candidateProfile.findMany({
        where: { id: { in: matches.map((match) => match.id) } },
        include: this.includeCandidate(),
      });

      return profiles
        .map((profile) => ({
          ...this.toSearchCandidate(profile),
          similarity: similarityById.get(profile.id) ?? null,
        }))
        .sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0));
    } catch (error) {
      throw new BadRequestException(`Semantic search is unavailable: ${(error as Error).message}`);
    }
  }

  private includeCandidate() {
    return {
      skills: { include: { skill: true } },
      education: true,
      experiences: true,
      cvs: { orderBy: { createdAt: 'desc' as const }, take: 1, include: { aiExtractions: { orderBy: { createdAt: 'desc' as const }, take: 1 } } },
      applications: {
        orderBy: { appliedAt: 'desc' as const },
        include: { screeningResult: true, campaignPosition: true },
      },
    };
  }

  private toSearchCandidate(profile: any) {
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
      skills: profile.skills?.map((item: any) => item.skill.name) ?? [],
      education: profile.education?.map((item: any) => item.degree ?? item.school) ?? [],
      gpa: profile.education?.find((item: any) => item.gpa)?.gpa,
      experience: profile.experiences?.reduce((sum: number, item: any) => sum + (item.years ?? 0), 0) ?? (extraction?.parsedJson as any)?.experienceYears ?? 0,
      campaignId: app?.campaignPosition?.campaignId,
      applicationId: app?.id,
      appliedAt: app?.appliedAt?.toISOString() ?? profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
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
