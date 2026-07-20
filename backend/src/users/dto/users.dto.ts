import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class UpdateStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
