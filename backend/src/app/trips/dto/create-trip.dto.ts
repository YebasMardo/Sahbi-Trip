import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  COMFORT_LEVELS,
  ComfortLevelEnum,
  INTERCITY_MODES,
  IntercityModeEnum,
  PACES,
  PaceEnum,
  TRANSPORT_MODES,
  TransportModeEnum,
  TRAVELER_TYPES,
  TravelerTypeEnum,
} from '../schemas/trip.schema';

// One city's share of the trip's total duration — only meaningful when
// `cities` has 2+ entries (see CreateTripDto.cityDurations).
export class CityDurationDto {
  @ApiProperty({ type: String })
  @IsString()
  city: string;

  @ApiProperty({ type: Number })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  days: number;
}

// Mirrors TripProfile (guide §12.1). No `owner` field — assigned from the
// token in TripsService.create (D6).
export class CreateTripDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ type: Number })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  durationDays: number;

  @ApiProperty({ type: Number })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  travelers: number;

  @ApiProperty({ type: Number })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  budgetTotal: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  budgetAccommodation?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  budgetActivities?: number;

  @ApiPropertyOptional({ type: String, default: 'MAD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  cities: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avoid?: string[];

  @ApiPropertyOptional({ type: String, enum: COMFORT_LEVELS })
  @IsOptional()
  @IsEnum(COMFORT_LEVELS, { message: 'Niveau de confort invalide.' })
  comfort?: ComfortLevelEnum;

  @ApiPropertyOptional({ type: String, enum: TRANSPORT_MODES })
  @IsOptional()
  @IsEnum(TRANSPORT_MODES, { message: 'Moyen de transport invalide.' })
  transport?: TransportModeEnum;

  @ApiPropertyOptional({ type: [CityDurationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CityDurationDto)
  cityDurations?: CityDurationDto[];

  @ApiPropertyOptional({ type: String, enum: INTERCITY_MODES })
  @IsOptional()
  @IsEnum(INTERCITY_MODES, { message: 'Moyen de transport inter-villes invalide.' })
  intercityTransport?: IntercityModeEnum;

  @ApiPropertyOptional({ type: String, enum: TRAVELER_TYPES })
  @IsOptional()
  @IsEnum(TRAVELER_TYPES, { message: 'Type de voyageur invalide.' })
  travelerType?: TravelerTypeEnum;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  alreadyInMorocco?: boolean;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  currentCity?: string;

  @ApiPropertyOptional({ type: String, enum: PACES })
  @IsOptional()
  @IsEnum(PACES, { message: 'Rythme de voyage invalide.' })
  pace?: PaceEnum;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietary?: string[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  travelNotes?: string;

  @ApiPropertyOptional({ type: String, default: 'fr' })
  @IsOptional()
  @IsString()
  language?: string;
}
