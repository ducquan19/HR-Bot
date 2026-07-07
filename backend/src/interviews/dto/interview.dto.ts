import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { InterviewStatus } from '@prisma/client';

export class CreateInterviewDto {
  @IsOptional()
  @IsString()
  candidateId?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkCreateInterviewDto {
  @IsArray()
  candidateIds!: string[];

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateInterviewStatusDto {
  @IsEnum(InterviewStatus)
  status!: InterviewStatus;
}

export class SubmitInterviewDto {
  @IsArray()
  answers!: Array<{ questionId: string; answer: string; duration?: number }>;
}
