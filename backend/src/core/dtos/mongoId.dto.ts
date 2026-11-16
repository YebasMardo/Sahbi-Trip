import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class MongoIdDto {
  @ApiProperty({ type: String, required: true })
  @IsMongoId({ message: 'Identifiant invalide.' })
  id: string;
}
