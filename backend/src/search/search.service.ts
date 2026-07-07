import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService, private readonly ai: AiService) {}

  async semanticCandidates(query: string, limit = 20) {
    const embedding = await this.ai.embed(query);
    const vectorLiteral = `[${embedding.join(',')}]`;
    try {
      return await this.prisma.$queryRawUnsafe(
        `SELECT cp.id, cp.first_name, cp.last_name, cp.email, 1 - (ce.embedding <=> $1::vector) AS similarity
         FROM candidate_embeddings ce
         JOIN candidate_profiles cp ON cp.id = ce.candidate_profile_id
         ORDER BY ce.embedding <=> $1::vector
         LIMIT $2`,
        vectorLiteral,
        limit,
      );
    } catch {
      return this.prisma.candidateProfile.findMany({
        where: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { skills: { some: { skill: { name: { contains: query, mode: 'insensitive' } } } } },
          ],
        },
        take: limit,
      });
    }
  }
}
