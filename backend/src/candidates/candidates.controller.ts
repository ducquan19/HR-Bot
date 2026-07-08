import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CandidatesService } from './candidates.service';
import { CandidateQueryDto, CandidateSearchDto, ScoreCandidatesDto, UpdateCandidateStageDto, UploadCandidateDto } from './dto/candidate.dto';

@ApiTags('Candidates')
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@CurrentUser() user: { id: string; role: string }, @Query() query: CandidateQueryDto) {
    return this.candidates.findAll(user, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('search')
  search(@Body() dto: CandidateSearchDto) {
    return this.candidates.search(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/report.pdf')
  async downloadReport(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string, @Res() res: Response) {
    const report = await this.candidates.generateReportPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.setHeader('Content-Length', report.buffer.length);
    res.send(report.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string) {
    return this.candidates.findOne(user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@CurrentUser() user: { id: string; role: string }, @Body() dto: UploadCandidateDto, @UploadedFile() file: Express.Multer.File) {
    return this.candidates.upload(user, dto, file);
  }

  @Post('public/upload')
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: 10 * 1024 * 1024 } }))
  publicUpload(@Body() dto: UploadCandidateDto, @UploadedFile() file: Express.Multer.File) {
    return this.candidates.upload(undefined, dto, file);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/stage')
  updateStage(@CurrentUser() user: { id: string; role: string }, @Param('id') id: string, @Body() dto: UpdateCandidateStageDto) {
    return this.candidates.updateStage(user, id, dto.stage);
  }

  @UseGuards(JwtAuthGuard)
  @Post('score')
  score(@CurrentUser() user: { id: string; role: string }, @Body() dto: ScoreCandidatesDto) {
    return this.candidates.score(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':candidateId/cv/:cvId/download')
  async downloadCv(@CurrentUser() user: { id: string; role: string }, @Param('candidateId') candidateId: string, @Param('cvId') cvId: string) {
    return this.candidates.getCvDownloadUrl(user, candidateId, cvId);
  }
}
