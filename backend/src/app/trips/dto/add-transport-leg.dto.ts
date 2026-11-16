import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { TRANSPORT_MODES, TransportModeEnum } from '../schemas/trip.schema';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Priced via transport-pricing.util.ts's estimateTransportCost — the same
// deterministic table the AI's estimateTransportCost tool uses. Never
// accepts a client-sent price.
export class AddTransportLegDto {
  @ApiProperty({ type: Number })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  day: number;

  // Day this leg is filed under — matches DayPlan.city on the arrival side.
  @ApiProperty({ type: String })
  @IsString()
  city: string;

  @ApiProperty({ type: String })
  @IsString()
  fromCity: string;

  @ApiProperty({ type: String })
  @IsString()
  toCity: string;

  @ApiProperty({ type: String, enum: TRANSPORT_MODES })
  @IsIn(TRANSPORT_MODES, { message: 'Moyen de transport invalide.' })
  mode: TransportModeEnum;

  @ApiProperty({ type: String, example: '07:30' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'Heure invalide (HH:MM).' })
  startTime: string;

  @ApiProperty({ type: String, example: '09:30' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'Heure invalide (HH:MM).' })
  endTime: string;

  // Free-text label shown as the item's name (e.g. "Trajet ONCF Marrakech →
  // Casablanca"). Falls back to a generated one from fromCity/toCity/mode.
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  label?: string;
}
