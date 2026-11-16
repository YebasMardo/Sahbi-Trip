import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChatTripDto {
  @ApiProperty({ type: String, required: true })
  @IsString()
  @MinLength(1)
  message: string;
}
