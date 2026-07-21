import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: { sub: string, role: string }) {
    const isAdmin = user.role === 'ADMIN' || user.role === 'admin';
    const userId = user.sub;

    const campaignWhere = isAdmin ? {} : {
      OR: [
        { createdById: userId },
        { members: { some: { userId } } }
      ]
    };

    const candidateWhere = isAdmin ? {} : {
      OR: [
        { cvs: { some: { uploadedById: userId } } },
        { applications: { some: { campaignPosition: { campaign: campaignWhere } } } }
      ]
    };

    const applicationWhere = isAdmin ? {} : {
      campaignPosition: {
        campaign: campaignWhere
      }
    };

    const [activeCampaigns, totalCandidates, applied, screeningDone, interviews, offers, rejected, scores, topSkills] = await Promise.all([
      this.prisma.recruitmentCampaign.count({ where: { status: 'ACTIVE', ...campaignWhere } }),
      this.prisma.candidateProfile.count({ where: candidateWhere }),
      this.prisma.candidateApplication.count({ where: { currentStage: 'APPLIED', ...applicationWhere } }),
      this.prisma.candidateApplication.count({ where: { NOT: { currentStage: 'APPLIED' }, ...applicationWhere } }),
      this.prisma.interviewSession.count({ where: { application: applicationWhere } }),
      this.prisma.candidateApplication.count({ where: { currentStage: 'OFFER', ...applicationWhere } }),
      this.prisma.candidateApplication.count({ where: { currentStage: 'REJECTED', ...applicationWhere } }),
      this.prisma.screeningResult.findMany({ where: { application: applicationWhere }, select: { overallScore: true } }),
      this.prisma.candidateSkill.groupBy({ 
        by: ['skillId'], 
        _count: { skillId: true }, 
        where: { candidateProfile: candidateWhere },
        orderBy: { _count: { skillId: 'desc' } }, 
        take: 10 
      }),
    ]);

    const skills = await this.prisma.skill.findMany({ where: { id: { in: topSkills.map((s) => s.skillId) } } });
    const scoreBuckets = this.bucketScores(scores.map((s) => s.overallScore));

    return {
      cards: { activeCampaigns, totalCandidates, screeningDone, pendingAction: applied, interviews },
      funnel: { applied, screeningDone, interviews, offers, rejected },
      scoreBuckets,
      topSkills: topSkills.map((item) => ({ skill: skills.find((s) => s.id === item.skillId)?.name, count: item._count.skillId })),
    };
  }

  private bucketScores(scores: number[]) {
    const buckets = [
      { range: '0-20', count: 0 },
      { range: '21-40', count: 0 },
      { range: '41-60', count: 0 },
      { range: '61-80', count: 0 },
      { range: '81-100', count: 0 },
    ];
    for (const score of scores) {
      const index = score <= 20 ? 0 : score <= 40 ? 1 : score <= 60 ? 2 : score <= 80 ? 3 : 4;
      buckets[index].count++;
    }
    return buckets;
  }
}
