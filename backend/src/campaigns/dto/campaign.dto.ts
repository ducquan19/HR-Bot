import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { CampaignStatus, EmploymentType } from '@prisma/client';

export class JobDescriptionDto {
  @IsString()
  overview!: string;

  @IsString()
  responsibilities!: string;

  @IsString()
  requirements!: string;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  experienceRequired?: number;

  @IsOptional()
  @IsString()
  educationRequired?: string;
}

export class PositionSkillDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  weight?: number;

  @IsOptional()
  isRequired?: boolean;
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsDateString()
  deadline!: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsString()
  positionTitle!: string;

  @IsOptional()
  @IsString()
  seniority?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ValidateNested()
  @Type(() => JobDescriptionDto)
  jd!: JobDescriptionDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionSkillDto)
  skills?: PositionSkillDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  vacancies?: number;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}

export class CreateApplicationFormDto {
  @IsOptional()
  isPublic?: boolean;

  @IsOptional()
  enabledFields?: Record<string, boolean>;
}
