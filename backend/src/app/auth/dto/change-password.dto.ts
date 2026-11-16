import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ type: String, required: true })
  @IsString()
  currentPassword: string;

  @ApiProperty({ type: String, required: true })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  newPassword: string;
}
