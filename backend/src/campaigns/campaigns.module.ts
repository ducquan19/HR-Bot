import { Module } from '@nestjs/common';
import { ApplicationFormsController } from './application-forms.controller';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  controllers: [CampaignsController, ApplicationFormsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
