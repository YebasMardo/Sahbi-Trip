import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ type: String, required: true })
  @IsString()
  @Length(6, 6, { message: 'Le code doit contenir 6 chiffres.' })
  code: string;
}
