import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class AdaptBudgetDto {
  @ApiProperty({ type: Number, description: 'Budget restant, en devise du voyage.' })
  @IsNumber()
  @Min(0)
  remaining: number;
}
