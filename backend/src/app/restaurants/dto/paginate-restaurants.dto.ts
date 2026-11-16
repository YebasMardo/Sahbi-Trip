import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/core/dtos/pagination.dto';
import { PRICE_LEVELS } from '../schemas/restaurant.schema';

export class PaginateRestaurantsDto extends PaginationDto<{
  city?: string;
  cuisine?: string;
  priceLevel?: string;
  query?: string;
}> {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  cuisine?: string;

  @ApiPropertyOptional({ type: String, enum: PRICE_LEVELS })
  @IsOptional()
  @IsIn(PRICE_LEVELS, { message: 'Niveau de prix invalide.' })
  priceLevel?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  query?: string;
}
