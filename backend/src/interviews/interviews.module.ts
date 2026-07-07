import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { INTERVIEW_QUEUE, QueueModule } from '../queue/queue.module';
import { AiModule } from '../ai/ai.module';
import { MailModule } from '../mail/mail.module';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

@Module({
  imports: [QueueModule, BullModule.registerQueue({ name: INTERVIEW_QUEUE }), AiModule, MailModule],
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule {}
