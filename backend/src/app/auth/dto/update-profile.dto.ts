import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Le nom complet est obligatoire.' })
  fullname?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsEmail(
    {},
    { message: 'Veuillez entrer une adresse email non vide et valide.' },
  )
  email?: string;

  // No @IsUrl(): the value only ever comes from a future upload endpoint's
  // own response, never typed by hand.
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
