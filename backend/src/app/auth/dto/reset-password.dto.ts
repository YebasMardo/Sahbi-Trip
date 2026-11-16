import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength } from 'class-validator';

// NO email field — the target user comes from the OTP token's claim, never the body.
export class ResetPasswordDto {
  @ApiProperty({ type: String, required: true })
  @IsString()
  @Length(6, 6, { message: 'Le code doit contenir 6 chiffres.' })
  code: string;

  @ApiProperty({ type: String, required: true })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  password: string;
}
