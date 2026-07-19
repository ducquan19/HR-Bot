import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { CV_QUEUE, INTERVIEW_QUEUE, QueueModule } from '../queue/queue.module';
import { FilesModule } from '../files/files.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiService } from './ai.service';
import { CandidateScreeningService } from './candidate-screening.service';
import { CvProcessingWorker } from './cv-processing.worker';
import { InterviewEvaluationWorker } from './interview-evaluation.worker';

import { AiController } from './ai.controller';
import { LivekitService } from './livekit.service';
import { LocalEmbeddingService } from './local-embedding.service';

@Module({
  imports: [ConfigModule, QueueModule, FilesModule, RealtimeModule, BullModule.registerQueue({ name: CV_QUEUE }, { name: INTERVIEW_QUEUE })],
  controllers: [AiController],
  providers: [AiService, CandidateScreeningService, CvProcessingWorker, InterviewEvaluationWorker, LivekitService, LocalEmbeddingService],
  exports: [AiService, CandidateScreeningService, LocalEmbeddingService],
})
export class AiModule {}
