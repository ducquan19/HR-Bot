import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateApplicationFormDto, CreateCampaignDto, CreateCampaignPositionDto, UpdateCampaignDto, UpdateCampaignMemberDto, UpdateCampaignPositionDto, UpsertCampaignMemberDto } from './dto/campaign.dto';

@ApiTags('Campaigns')
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string; role: string }) {
    return this.campaigns.findAll(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string) {
    return this.campaigns.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string) {
    return this.campaigns.remove(user, id);
  }

  @Post(':id/application-form')
  createApplicationForm(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string, @Body() dto: CreateApplicationFormDto) {
    return this.campaigns.createOrUpdateForm(user, id, dto);
  }

  @Post(':id/positions')
  addPosition(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string, @Body() dto: CreateCampaignPositionDto) {
    return this.campaigns.addPosition(user, id, dto);
  }

  @Patch(':id/positions/:campaignPositionId')
  updatePosition(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
    @Param('campaignPositionId') campaignPositionId: string,
    @Body() dto: UpdateCampaignPositionDto,
  ) {
    return this.campaigns.updatePosition(user, id, campaignPositionId, dto);
  }

  @Get(':id/members')
  findMembers(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string) {
    return this.campaigns.findMembers(user, id);
  }

  @Post(':id/members')
  upsertMember(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string, @Body() dto: UpsertCampaignMemberDto) {
    return this.campaigns.upsertMember(user, id, dto);
  }

  @Patch(':id/members/:memberId')
  updateMember(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string, @Param('memberId') memberId: string, @Body() dto: UpdateCampaignMemberDto) {
    return this.campaigns.updateMember(user, id, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  removeMember(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string, @Param('memberId') memberId: string) {
    return this.campaigns.removeMember(user, id, memberId);
  }
}
