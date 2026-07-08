import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';

@ApiTags('Campaigns')
@Controller('application-forms')
export class ApplicationFormsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get('public/:token')
  findPublic(@Param('token') token: string) {
    return this.campaigns.findPublicApplicationForm(token);
  }
}
