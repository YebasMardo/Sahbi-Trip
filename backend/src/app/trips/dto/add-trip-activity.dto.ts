import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Matches, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Adds a catalogue place (activity or restaurant) directly, picked by the
// traveler from ActivityPicker — distinct from the AI-suggested alternatives
// endpoint (/:id/activities/:taId/replace), which only proposes, never mutates.
export class AddTripActivityDto {
  @ApiProperty({ type: String, enum: ['activity', 'restaurant'] })
  @IsIn(['activity', 'restaurant'], { message: 'Type invalide.' })
  type: 'activity' | 'restaurant';

  // Slug _id of the catalogue row (Activity or Restaurant) — validated
  // against the catalogue before insert, never trusted as-is.
  @ApiProperty({ type: String })
  @IsString()
  refId: string;

  @ApiProperty({ type: Number })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  day: number;

  @ApiProperty({ type: String, example: '09:00' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'Heure invalide (HH:MM).' })
  startTime: string;

  @ApiProperty({ type: String, example: '10:30' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'Heure invalide (HH:MM).' })
  endTime: string;
}
