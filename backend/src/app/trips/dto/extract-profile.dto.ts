import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ExtractProfileDto {
  @ApiProperty({ type: String, required: true })
  @IsString()
  @MinLength(1)
  text: string;
}
