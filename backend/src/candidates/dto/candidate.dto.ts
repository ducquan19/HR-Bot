import { IsArray, IsEmail, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApplicationStage } from '@prisma/client';

export class UploadCandidateDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  campaignPositionId?: string;

  @IsOptional()
  @IsString()
  github?: string;

  @IsOptional()
  @IsString()
  portfolio?: string;
}

export class CandidateQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ApplicationStage)
  stage?: ApplicationStage;

  @IsOptional()
  @IsString()
  skill?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  scoreMin?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  scoreMax?: number;
}

export class UpdateCandidateStageDto {
  @IsEnum(ApplicationStage)
  stage!: ApplicationStage;
}

export class ScoreCandidatesDto {
  @IsOptional()
  @IsArray()
  candidateIds?: string[];

  @IsOptional()
  @IsString()
  campaignId?: string;
}
