import { IsArray, IsEmail, IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApplicationStage } from '@prisma/client';

export class UploadCandidateDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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
  @IsString()
  campaignId?: string;

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

export class CandidateSearchDto {
  @IsIn(['criteria', 'semantic'])
  mode!: 'criteria' | 'semantic';

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  skill?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsIn(['and', 'or'])
  skillOperator?: 'and' | 'or';

  @IsOptional()
  @IsEnum(ApplicationStage)
  stage?: ApplicationStage;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  experienceMin?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  experienceMax?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  scoreMin?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  scoreMax?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
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
