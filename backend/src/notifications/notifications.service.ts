import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'campaign_deadline_urgent'   // deadline ≤ 3 days
  | 'campaign_deadline_soon'     // deadline ≤ 7 days
  | 'campaign_created'           // campaign created ≤ 3 days ago
  | 'campaign_closed'            // campaign closed ≤ 2 days ago
  | 'new_candidates'             // new candidates applied in last 24h
  | 'interview_upcoming'         // interview in next 24h
  | 'cv_processing_complete'     // CV analysis done in last 6h
  | 'high_score_candidate';      // candidate with score ≥ 85 joined in last 24h

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  link?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(userId: string, userRole: string): Promise<AppNotification[]> {
    const notifications: AppNotification[] = [];
    const now = new Date();

    // ── 1. Campaign Deadline Alerts ────────────────────────────────────────────
    const activeCampaigns = await this.prisma.recruitmentCampaign.findMany({
      where: {
        status: 'ACTIVE',
        ...(userRole !== 'ADMIN'
          ? {
              OR: [
                { createdById: userId },
                { members: { some: { userId } } },
              ],
            }
          : {}),
      },
      select: { id: true, title: true, deadline: true, createdAt: true, createdById: true },
      orderBy: { deadline: 'asc' },
    });

    for (const campaign of activeCampaigns) {
      const daysToDeadline = Math.ceil(
        (campaign.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysToDeadline <= 0) continue; // already expired

      if (daysToDeadline <= 3) {
        notifications.push({
          id: `deadline_urgent_${campaign.id}`,
          type: 'campaign_deadline_urgent',
          title: '🔴 Chiến dịch sắp hết hạn!',
          message: `"${campaign.title}" còn ${daysToDeadline} ngày đến hạn`,
          createdAt: now.toISOString(),
          link: '/campaigns',
          metadata: { campaignId: campaign.id, daysLeft: daysToDeadline },
        });
      } else if (daysToDeadline <= 7) {
        notifications.push({
          id: `deadline_soon_${campaign.id}`,
          type: 'campaign_deadline_soon',
          title: '🟡 Chiến dịch sắp đến hạn',
          message: `"${campaign.title}" còn ${daysToDeadline} ngày đến hạn`,
          createdAt: now.toISOString(),
          link: '/campaigns',
          metadata: { campaignId: campaign.id, daysLeft: daysToDeadline },
        });
      }
    }

    // ── 2. Recently Created Campaigns ─────────────────────────────────────────
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const newCampaigns = await this.prisma.recruitmentCampaign.findMany({
      where: {
        createdAt: { gte: threeDaysAgo },
        ...(userRole !== 'ADMIN' ? { createdById: userId } : {}),
      },
      select: { id: true, title: true, createdAt: true, department: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const campaign of newCampaigns) {
      const hoursAgo = Math.floor(
        (now.getTime() - campaign.createdAt.getTime()) / (1000 * 60 * 60),
      );
      const timeLabel = hoursAgo < 1 ? 'vừa xong' : hoursAgo < 24 ? `${hoursAgo}h trước` : `${Math.floor(hoursAgo / 24)} ngày trước`;
      notifications.push({
        id: `created_${campaign.id}`,
        type: 'campaign_created',
        title: '✅ Chiến dịch mới được tạo',
        message: `"${campaign.title}"${campaign.department ? ` (${campaign.department})` : ''} — ${timeLabel}`,
        createdAt: campaign.createdAt.toISOString(),
        link: '/campaigns',
        metadata: { campaignId: campaign.id },
      });
    }

    // ── 3. New Candidates in last 24h ─────────────────────────────────────────
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const newApps = await this.prisma.candidateApplication.groupBy({
      by: ['campaignPositionId'],
      where: {
        appliedAt: { gte: oneDayAgo },
        campaignPosition: {
          campaign: userRole !== 'ADMIN'
            ? { OR: [{ createdById: userId }, { members: { some: { userId } } }] }
            : {},
        },
      },
      _count: { id: true },
    });

    // Get campaign names for each position
    if (newApps.length > 0) {
      const positionIds = newApps.map(a => a.campaignPositionId);
      const positions = await this.prisma.campaignPosition.findMany({
        where: { id: { in: positionIds } },
        select: { id: true, campaign: { select: { id: true, title: true } } },
      });

      // Group by campaign
      const byCampaign = new Map<string, { title: string; count: number }>();
      for (const app of newApps) {
        const pos = positions.find(p => p.id === app.campaignPositionId);
        if (!pos) continue;
        const cid = pos.campaign.id;
        const existing = byCampaign.get(cid);
        if (existing) {
          existing.count += app._count.id;
        } else {
          byCampaign.set(cid, { title: pos.campaign.title, count: app._count.id });
        }
      }

      for (const [cid, data] of byCampaign.entries()) {
        notifications.push({
          id: `new_candidates_${cid}`,
          type: 'new_candidates',
          title: '👤 Ứng viên mới',
          message: `${data.count} ứng viên mới ứng tuyển vào "${data.title}" trong 24h qua`,
          createdAt: oneDayAgo.toISOString(),
          link: '/candidates',
          metadata: { campaignId: cid, count: data.count },
        });
      }
    }

    // ── 4. Upcoming Interviews in next 24h ────────────────────────────────────
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const upcomingInterviews = await this.prisma.interviewSession.findMany({
      where: {
        scheduledAt: { gte: now, lte: tomorrow },
        status: { in: ['PENDING', 'SENT'] },
        ...(userRole !== 'ADMIN' ? { createdById: userId } : {}),
      },
      include: {
        application: {
          select: {
            candidateProfile: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });

    for (const interview of upcomingInterviews) {
      const hoursUntil = Math.ceil(
        (interview.scheduledAt!.getTime() - now.getTime()) / (1000 * 60 * 60),
      );
      const profile = interview.application?.candidateProfile;
      const candidateName = profile
        ? `${profile.firstName} ${profile.lastName}`
        : 'Ứng viên';
      notifications.push({
        id: `interview_${interview.id}`,
        type: 'interview_upcoming',
        title: '📅 Phỏng vấn sắp diễn ra',
        message: `Phỏng vấn với ${candidateName} trong ${hoursUntil}h nữa`,
        createdAt: interview.scheduledAt!.toISOString(),
        link: '/interviews',
        metadata: { interviewId: interview.id, hoursUntil },
      });
    }


    // ── 5. CV Analysis Completed in last 6h ───────────────────────────────────
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const completedCvs = await this.prisma.cv.findMany({
      where: {
        processingStatus: 'COMPLETED',
        updatedAt: { gte: sixHoursAgo },
        candidateProfile: {
          applications: {
            some: {
              screeningResult: { isNot: null },
              campaignPosition: {
                campaign: userRole !== 'ADMIN'
                  ? { OR: [{ createdById: userId }, { members: { some: { userId } } }] }
                  : {},
              },
            },
          },
        },
      },
      include: {
        candidateProfile: {
          select: {
            firstName: true,
            lastName: true,
            applications: {
              select: {
                screeningResult: { select: { overallScore: true, recommendation: true } },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    const highScorers: AppNotification[] = [];
    const regularCompleted: AppNotification[] = [];

    for (const cv of completedCvs) {
      const profile = cv.candidateProfile;
      if (!profile) continue;
      const name = `${profile.firstName} ${profile.lastName}`;
      const app = profile.applications[0];
      const score = app?.screeningResult?.overallScore;
      const scorePercent = score !== undefined ? Math.round(score) : null;

      if (scorePercent !== null && scorePercent >= 85) {
        highScorers.push({
          id: `high_score_${cv.id}`,
          type: 'high_score_candidate',
          title: '⭐ Ứng viên xuất sắc',
          message: `${name} đạt ${scorePercent}% độ phù hợp - đáng xem xét ngay!`,
          createdAt: cv.updatedAt.toISOString(),
          link: '/candidates',
          metadata: { score: scorePercent },
        });
      } else {
        regularCompleted.push({
          id: `cv_done_${cv.id}`,
          type: 'cv_processing_complete',
          title: '🤖 Phân tích CV hoàn tất',
          message: `CV của ${name}${scorePercent !== null ? ` - ${scorePercent}% phù hợp` : ''} đã được phân tích xong`,
          createdAt: cv.updatedAt.toISOString(),
          link: '/candidates',
          metadata: { score: scorePercent },
        });
      }
    }

    notifications.push(...highScorers, ...regularCompleted.slice(0, 3));

    // Sort by createdAt descending, limit 30
    notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return notifications.slice(0, 30);
  }
}
