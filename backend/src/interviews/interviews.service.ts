import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { InterviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { MailService } from '../mail/mail.service';
import { INTERVIEW_QUEUE } from '../queue/queue.module';
import { CreateInterviewDto, SubmitInterviewDto } from './dto/interview.dto';

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @InjectQueue(INTERVIEW_QUEUE) private readonly interviewQueue: Queue,
  ) {}

  async findAll() {
    const sessions = await this.prisma.interviewSession.findMany({
      include: { application: { include: { candidateProfile: true } }, questions: true },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => this.toFrontendInterview(s));
  }

  async create(userId: string, dto: CreateInterviewDto) {
    const application = await this.resolveApplication(dto);
    const publicToken = uuid();
    const frontendUrl = this.config.get<string>('frontendUrl');
    const session = await this.prisma.interviewSession.create({
      data: {
        applicationId: application.id,
        publicToken,
        meetingUrl: `${frontendUrl}/interview/${publicToken}`,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdById: userId,
        notes: dto.notes,
      },
      include: { application: { include: { candidateProfile: true } } },
    });

    await this.generateQuestions(session.id, application.id);
    await this.prisma.candidateApplication.update({ where: { id: application.id }, data: { currentStage: 'VIRTUAL_INTERVIEW' } });
    return this.findOne(session.id);
  }

  async findOne(id: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id },
      include: { application: { include: { candidateProfile: true } }, questions: { include: { answer: true }, orderBy: { order: 'asc' } } },
    });
    if (!session) throw new NotFoundException('Interview not found');
    return session;
  }

  async sendInvite(id: string) {
    const session = await this.prisma.interviewSession.findUnique({ where: { id }, include: { application: { include: { candidateProfile: true } } } });
    if (!session) throw new NotFoundException('Interview not found');
    await this.mail.sendInterviewInvite(session.application.candidateProfile.email, session.meetingUrl);
    await this.prisma.interviewSession.update({ where: { id }, data: { status: 'SENT' } });
    return { sent: true };
  }

  async updateStatus(id: string, status: InterviewStatus) {
    const session = await this.prisma.interviewSession.update({ where: { id }, data: { status } });
    if (status === 'COMPLETED') await this.interviewQueue.add('evaluate-interview', { sessionId: id });
    return session;
  }

  async findPublic(token: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { publicToken: token },
      include: { questions: { orderBy: { order: 'asc' } }, application: { include: { candidateProfile: true } } },
    });
    if (!session || session.expiresAt < new Date()) throw new NotFoundException('Interview link is invalid or expired');
    return session;
  }

  async submitPublic(token: string, dto: SubmitInterviewDto) {
    const session = await this.findPublic(token);
    for (const answer of dto.answers) {
      await this.prisma.interviewAnswer.upsert({
        where: { questionId: answer.questionId },
        create: { questionId: answer.questionId, answer: answer.answer, duration: answer.duration },
        update: { answer: answer.answer, duration: answer.duration },
      });
    }
    await this.prisma.interviewSession.update({ where: { id: session.id }, data: { status: 'COMPLETED' } });
    await this.interviewQueue.add('evaluate-interview', { sessionId: session.id });
    return { submitted: true };
  }

  private async resolveApplication(dto: CreateInterviewDto) {
    if (dto.applicationId) return this.prisma.candidateApplication.findUniqueOrThrow({ where: { id: dto.applicationId } });
    if (dto.candidateId) {
      const app = await this.prisma.candidateApplication.findFirst({ where: { candidateProfileId: dto.candidateId }, orderBy: { appliedAt: 'desc' } });
      if (app) return app;
    }
    throw new BadRequestException('applicationId or candidateId is required');
  }

  private async generateQuestions(sessionId: string, applicationId: string) {
    const app = await this.prisma.candidateApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: {
        cv: { include: { aiExtractions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        campaignPosition: { include: { position: { include: { jobDescription: true, positionSkills: { include: { skill: true } } } } } },
      },
    });
    const parsed = app.cv.aiExtractions[0]?.parsedJson as any;
    const questions = await this.ai.generateInterviewQuestions({ parsedCv: parsed ?? { skills: [], education: [], projects: [], experienceYears: 0, summary: '' }, jd: app.campaignPosition.position.jobDescription, positionSkills: app.campaignPosition.position.positionSkills });
    await this.prisma.interviewQuestion.createMany({ data: questions.map((q) => ({ sessionId, ...q })) });
  }

  private toFrontendInterview(session: any) {
    return {
      id: session.id,
      candidateIds: [session.application.candidateProfile.id],
      candidateId: session.application.candidateProfile.id,
      scheduledAt: (session.scheduledAt ?? session.createdAt).toISOString(),
      interviewLink: session.meetingUrl,
      status: session.status.toLowerCase(),
      campaignId: undefined,
      createdBy: session.createdById,
      createdAt: session.createdAt.toISOString(),
    };
  }
}
