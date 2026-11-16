import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class OptimizeTripDto {
  // Optimise one day only; omit to optimise the whole trip.
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  day?: number;
}
