import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

export const CV_QUEUE = 'cv-processing';
export const INTERVIEW_QUEUE = 'interview-processing';

@Module({
  imports: [
    BullModule.registerQueue({ name: CV_QUEUE }),
    BullModule.registerQueue({ name: INTERVIEW_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
