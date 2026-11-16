import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ type: String, required: true })
  @IsString()
  @MinLength(1)
  fullname: string;

  @ApiProperty({ type: String, required: true })
  @IsEmail(
    {},
    { message: 'Veuillez entrer une adresse email non vide et valide.' },
  )
  email: string;

  @ApiProperty({ type: String, required: true })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  password: string;
}
