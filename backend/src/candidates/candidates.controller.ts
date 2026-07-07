import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CandidatesService } from './candidates.service';
import { CandidateQueryDto, ScoreCandidatesDto, UpdateCandidateStageDto, UploadCandidateDto } from './dto/candidate.dto';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() query: CandidateQueryDto) {
    return this.candidates.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/report.pdf')
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const report = await this.candidates.generateReportPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.setHeader('Content-Length', report.buffer.length);
    res.send(report.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.candidates.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@CurrentUser() user: { id: string }, @Body() dto: UploadCandidateDto, @UploadedFile() file: Express.Multer.File) {
    return this.candidates.upload(user.id, dto, file);
  }

  @Post('public/upload')
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: 10 * 1024 * 1024 } }))
  publicUpload(@Body() dto: UploadCandidateDto, @UploadedFile() file: Express.Multer.File) {
    return this.candidates.upload(undefined, dto, file);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/stage')
  updateStage(@Param('id') id: string, @Body() dto: UpdateCandidateStageDto) {
    return this.candidates.updateStage(id, dto.stage);
  }

  @UseGuards(JwtAuthGuard)
  @Post('score')
  score(@Body() dto: ScoreCandidatesDto) {
    return this.candidates.score(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':candidateId/cv/:cvId/download')
  async downloadCv(@Param('candidateId') candidateId: string, @Param('cvId') cvId: string) {
    return this.candidates.getCvDownloadUrl(candidateId, cvId);
  }
}
