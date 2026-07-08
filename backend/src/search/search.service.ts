import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService, private readonly ai: AiService) {}

  async semanticCandidates(query: string, limit = 20) {
    if (!query?.trim()) return [];
    const embedding = await this.ai.embed(query, 'query');
    const vectorLiteral = `[${embedding.join(',')}]`;
    try {
      return await this.prisma.$queryRawUnsafe(
        `SELECT cp.id, cp.first_name AS "firstName", cp.last_name AS "lastName", cp.email, 1 - (ce.embedding <=> $1::vector) AS similarity
         FROM candidate_embeddings ce
         JOIN candidate_profiles cp ON cp.id = ce.candidate_profile_id
         ORDER BY ce.embedding <=> $1::vector
         LIMIT $2`,
        vectorLiteral,
        limit,
      );
    } catch {
      const candidates = await this.prisma.candidateProfile.findMany({
        where: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { skills: { some: { skill: { name: { contains: query, mode: 'insensitive' } } } } },
          ],
        },
        take: limit,
      });
      return candidates.map((candidate) => ({
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        similarity: null,
      }));
    }
  }
}
