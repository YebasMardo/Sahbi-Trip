import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/core/dtos/pagination.dto';
import { ACTIVITY_CATEGORIES, ActivityCategoryEnum, TOURIST_LEVELS, TouristLevelEnum } from '../schemas/activity.schema';

export class PaginateActivitiesDto extends PaginationDto<{
  city?: string;
  category?: ActivityCategoryEnum;
  isFree?: boolean;
  touristLevel?: TouristLevelEnum;
  maxPrice?: number;
  query?: string;
}> {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ type: String, enum: ACTIVITY_CATEGORIES })
  @IsOptional()
  @IsEnum(ACTIVITY_CATEGORIES, { message: 'Catégorie invalide.' })
  category?: ActivityCategoryEnum;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFree?: boolean;

  @ApiPropertyOptional({ type: String, enum: TOURIST_LEVELS })
  @IsOptional()
  @IsEnum(TOURIST_LEVELS, { message: 'Niveau touristique invalide.' })
  touristLevel?: TouristLevelEnum;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  maxPrice?: number;

  // Free-text search over name/description/tags — used when no vector
  // search is warranted (simple catalogue browsing, not AI retrieval).
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  query?: string;
}
