import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateInterviewDto, SubmitInterviewDto, UpdateInterviewStatusDto } from './dto/interview.dto';
import { InterviewsService } from './interviews.service';

@ApiTags('Interviews')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.interviews.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateInterviewDto) {
    return this.interviews.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateInterviewStatusDto) {
    return this.interviews.updateStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/send-invite')
  sendInvite(@Param('id') id: string) {
    return this.interviews.sendInvite(id);
  }

  @Get('public/:token')
  findPublic(@Param('token') token: string) {
    return this.interviews.findPublic(token);
  }

  @Post('public/:token/submit')
  submitPublic(@Param('token') token: string, @Body() dto: SubmitInterviewDto) {
    return this.interviews.submitPublic(token, dto);
  }
}
