import { Controller, Get, Param, Post, Body, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { InterviewsService } from './interviews.service';

@ApiTags('AI Interviews Webhooks')
@Controller('ai/interviews')
export class AiInterviewsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly interviews: InterviewsService
  ) {}

  @Get('public/:token/livekit-token')
  async getLiveKitToken(@Param('token') token: string) {
    const data = await this.interviews.generateLiveKitToken(token);
    return { data };
  }

  @Get(':id/context')
  async getContext(@Param('id') id: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            candidateProfile: true,
            cv: {
              include: {
                aiExtractions: {
                  orderBy: { createdAt: 'desc' },
                  take: 1
                }
              }
            },
            campaignPosition: {
              include: {
                position: {
                  include: {
                    jobDescription: true
                  }
                }
              }
            },
          }
        },
        questions: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!session) throw new NotFoundException('Session not found');

    const jd = session.application.campaignPosition.position.jobDescription?.requirements || '';
    const cvExtraction = session.application.cv?.aiExtractions?.[0];
    const cv = cvExtraction ? JSON.stringify(cvExtraction.parsedJson) : JSON.stringify(session.application.candidateProfile);
    const candidateName = `${session.application.candidateProfile.firstName} ${session.application.candidateProfile.lastName}`;

    return {
      interview_id: session.id,
      candidate_name: candidateName,
      job_description: jd,
      cv_data: cv,
      plan: {
        topics: [
          {
            title: "Giới thiệu bản thân",
            type: "intro",
            questions: ["Mời bạn giới thiệu một chút về bản thân và kinh nghiệm làm việc."],
          },
          {
            title: "Kỹ năng chuyên môn",
            type: "technical",
            questions: session.questions.map(q => q.question),
          },
          {
            title: "Kết thúc",
            type: "closing",
            questions: ["Bạn có câu hỏi nào cho chúng tôi không?"],
          }
        ]
      }
    };
  }

  @Post(':id/end')
  async endInterview(@Param('id') id: string) {
    await this.interviews.updateStatus(id, 'COMPLETED');
    return { success: true };
  }

  @Post(':id/transcript')
  async addTranscriptTurn(
    @Param('id') id: string,
    @Body() body: { role: string; content: string; ts?: number }
  ) {
    const session = await this.prisma.interviewSession.findUnique({ where: { id } });
    if (session) {
      const newLine = `[${new Date().toISOString()}] ${body.role}: ${body.content}\n`;
      await this.prisma.interviewSession.update({
        where: { id },
        data: { notes: (session.notes || '') + newLine }
      });
    }
    return { success: true };
  }
}
