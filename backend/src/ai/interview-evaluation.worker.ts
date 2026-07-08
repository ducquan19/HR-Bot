import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { INTERVIEW_QUEUE } from '../queue/queue.module';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

@Processor(INTERVIEW_QUEUE)
export class InterviewEvaluationWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {
    super();
  }

  async process(job: Job<{ sessionId: string }>) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: job.data.sessionId },
      include: { questions: { include: { answer: true } } },
    });
    if (!session) return;
    
    const evaluation = await this.ai.evaluateInterview(session.questions);
    
    await this.prisma.interviewSession.update({
      where: { id: session.id },
      data: { aiEvaluation: evaluation },
    });
  }
}
