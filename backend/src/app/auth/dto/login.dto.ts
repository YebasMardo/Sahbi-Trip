import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ type: String, required: true })
  @IsEmail(
    {},
    { message: 'Veuillez entrer une adresse email non vide et valide.' },
  )
  email: string;

  @ApiProperty({ type: String, required: true })
  @IsString()
  password: string;
}
