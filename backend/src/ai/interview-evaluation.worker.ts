import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { INTERVIEW_QUEUE } from '../queue/queue.module';
import { PrismaService } from '../prisma/prisma.service';

@Processor(INTERVIEW_QUEUE)
export class InterviewEvaluationWorker extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ sessionId: string }>) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: job.data.sessionId },
      include: { questions: { include: { answer: true } } },
    });
    if (!session) return;
    const answered = session.questions.filter((q) => q.answer?.answer).length;
    const score = session.questions.length ? Math.round((answered / session.questions.length) * 100) : 0;
    await this.prisma.interviewSession.update({
      where: { id: session.id },
      data: { aiEvaluation: { score, feedback: 'Mock interview evaluation. Replace with LLM rubric evaluator.' } },
    });
  }
}
