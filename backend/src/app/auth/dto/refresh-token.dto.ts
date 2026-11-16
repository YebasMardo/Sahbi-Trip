import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ type: String, required: true })
  @IsMongoId({ message: 'Identifiant invalide.' })
  id: string;

  @ApiProperty({ type: String, required: true })
  @IsString()
  value: string;
}
