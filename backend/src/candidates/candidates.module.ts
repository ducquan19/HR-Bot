import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CV_QUEUE, QueueModule } from '../queue/queue.module';
import { FilesModule } from '../files/files.module';
import { AiModule } from '../ai/ai.module';
import { SearchModule } from '../search/search.module';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';

@Module({
  imports: [QueueModule, BullModule.registerQueue({ name: CV_QUEUE }), FilesModule, AiModule, SearchModule],
  controllers: [CandidatesController],
  providers: [CandidatesService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
