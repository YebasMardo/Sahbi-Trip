import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { TRIP_ITEM_STATUSES, TripItemStatusEnum } from '../schemas/trip-activity.schema';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// One PATCH covers reschedule / status-change / content-swap — they all
// touch a single TripActivity row. All fields optional; the service applies
// whichever ones are present. `refId`+`type` together mean "swap the place",
// mirroring the frontend's replaceActivityInDay (transport legs are not
// swappable this way — delete and add a new one instead).
export class UpdateTripActivityDto {
  @ApiPropertyOptional({ type: String, enum: ['activity', 'restaurant'] })
  @IsOptional()
  @IsIn(['activity', 'restaurant'], { message: 'Type invalide.' })
  type?: 'activity' | 'restaurant';

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  refId?: string;

  @ApiPropertyOptional({ type: String, example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'Heure invalide (HH:MM).' })
  startTime?: string;

  @ApiPropertyOptional({ type: String, example: '10:30' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'Heure invalide (HH:MM).' })
  endTime?: string;

  @ApiPropertyOptional({ type: String, enum: TRIP_ITEM_STATUSES })
  @IsOptional()
  @IsIn(TRIP_ITEM_STATUSES, { message: 'Statut invalide.' })
  status?: TripItemStatusEnum;
}
