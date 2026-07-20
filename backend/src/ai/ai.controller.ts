import { Controller, Get, Param, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LivekitService } from './livekit.service';
import { PrismaService } from '../prisma/prisma.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { INTERVIEW_QUEUE } from '../queue/queue.module';

@ApiTags('AI Voice Interview')
@Controller('ai/interviews')
export class AiController {
  constructor(
    private readonly livekit: LivekitService,
    private readonly prisma: PrismaService,
    @InjectQueue(INTERVIEW_QUEUE) private readonly interviewQueue: Queue,
  ) {}

  @Get('public/:token/livekit-token')
  async getLivekitToken(@Param('token') token: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { publicToken: token },
      include: {
        application: {
          include: { candidateProfile: true }
        }
      }
    });
    if (!session) {
      throw new UnauthorizedException('Invalid interview token');
    }
    
    // Room name is based on interview session ID
    const roomName = `interview-${session.id}`;
    const participantIdentity = `candidate-${session.id}`;
    const participantName = session.application.candidateProfile.firstName;

    const livekitToken = await this.livekit.generateToken(roomName, participantName, participantIdentity);
    return { token: livekitToken, url: process.env.LIVEKIT_URL || 'ws://localhost:7880' };
  }

  @Get(':id/context')
  async getContext(@Param('id') id: string) {
    // This is called by Python AI Agent to get CV and JD data
    const session = await this.prisma.interviewSession.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            cv: { include: { aiExtractions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
            candidateProfile: true,
            campaignPosition: {
              include: {
                position: {
                  include: { jobDescription: true, positionSkills: { include: { skill: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!session) throw new UnauthorizedException('Session not found');

    const parsedCv = session.application.cv.aiExtractions[0]?.parsedJson;
    return {
      candidate: session.application.candidateProfile,
      parsedCv,
      jobDescription: session.application.campaignPosition.position.jobDescription,
      positionSkills: session.application.campaignPosition.position.positionSkills,
    };
  }

  @Post(':id/transcripts')
  async appendTranscript(
    @Param('id') id: string,
    @Body() body: { role: string; content: string; ts: number },
  ) {
    // This is called by Python AI Agent to append chat
    const session = await this.prisma.interviewSession.findUnique({ where: { id } });
    if (!session) throw new UnauthorizedException();

    const currentTranscript = (session.transcript as any[]) || [];
    currentTranscript.push({ role: body.role, content: body.content, ts: body.ts });

    await this.prisma.interviewSession.update({
      where: { id },
      data: { transcript: currentTranscript },
    });
    return { success: true };
  }

  @Post(':id/end')
  async endInterview(@Param('id') id: string, @Body() body: any) {
    const session = await this.prisma.interviewSession.findUnique({ where: { id } });
    
    let updatedNotes = session?.notes || '';
    if (body?.tabSwitches > 0) {
      const warning = `[ANTI-CHEAT] Detected ${body.tabSwitches} tab switches during interview.\n`;
      updatedNotes = warning + updatedNotes;
    }

    await this.prisma.interviewSession.update({
      where: { id },
      data: { 
        status: 'COMPLETED',
        notes: updatedNotes !== '' ? updatedNotes : undefined
      },
    });
    
    // Trigger evaluation worker
    await this.interviewQueue.add('evaluate', { sessionId: id });
    return { success: true };
  }
}
