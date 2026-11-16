import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ type: String, required: true })
  @IsEmail(
    {},
    { message: 'Veuillez entrer une adresse email non vide et valide.' },
  )
  email: string;
}
