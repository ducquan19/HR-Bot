import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { CampaignMemberRole, CampaignStatus, EmploymentType } from '@prisma/client';

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

export class CreateCampaignPositionDto {
  @IsOptional()
  @IsString()
  positionId?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  seniority?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobDescriptionDto)
  jd?: JobDescriptionDto;

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

  @IsOptional()
  @IsString()
  positionTitle?: string;

  @IsOptional()
  @IsString()
  seniority?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobDescriptionDto)
  jd?: JobDescriptionDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionSkillDto)
  skills?: PositionSkillDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  vacancies?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCampaignPositionDto)
  positions?: CreateCampaignPositionDto[];
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

export class UpdateCampaignPositionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  seniority?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsInt()
  @Min(1)
  vacancies?: number;

  @IsOptional()
  @IsString()
  overview?: string;

  @IsOptional()
  @IsString()
  responsibilities?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  benefits?: string;
}

export class CreateApplicationFormDto {
  @IsOptional()
  isPublic?: boolean;

  @IsOptional()
  enabledFields?: Record<string, boolean>;
}

export class UpsertCampaignMemberDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsEnum(CampaignMemberRole)
  role?: CampaignMemberRole;
}

export class UpdateCampaignMemberDto {
  @IsEnum(CampaignMemberRole)
  role!: CampaignMemberRole;
}
