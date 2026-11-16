import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserDocument } from 'src/app/users/schemas/user.schema';

// ── Enums, each paired with a value array ───────────────────────────
export enum TripStatusEnum {
  DRAFT = 'draft',
  GENERATING = 'generating',
  GENERATED = 'generated',
  FILLING = 'filling',
  CONFIRMED = 'confirmed',
}
export const TRIP_STATUSES = Object.values(TripStatusEnum);

export enum ComfortLevelEnum {
  BUDGET = 'budget',
  MID_RANGE = 'mid-range',
  LUXURY = 'luxury',
}
export const COMFORT_LEVELS = Object.values(ComfortLevelEnum);

export enum TransportModeEnum {
  CAR = 'car',
  PUBLIC = 'public',
  WALK = 'walk',
  MIXED = 'mixed',
}
export const TRANSPORT_MODES = Object.values(TransportModeEnum);

// Inter-city preference — distinct from TransportModeEnum above, which is
// the traveler's *local* (in-city) moving style. See transport-pricing.util.ts.
export enum IntercityModeEnum {
  TRAIN = 'train',
  BUS = 'bus',
  TAXI = 'taxi',
  ANY = 'any',
}
export const INTERCITY_MODES = Object.values(IntercityModeEnum);

export enum TravelerTypeEnum {
  SOLO = 'solo',
  COUPLE = 'couple',
  FAMILY = 'family',
  GROUP = 'group',
}
export const TRAVELER_TYPES = Object.values(TravelerTypeEnum);

export enum PaceEnum {
  RELAXED = 'relaxed',
  BALANCED = 'balanced',
  INTENSE = 'intense',
}
export const PACES = Object.values(PaceEnum);

export interface CityDuration {
  city: string;
  days: number;
}

// ── Document type alias ─────────────────────────────────────────────
export type TripDocument = HydratedDocument<Trip>;

// ── The schema class ────────────────────────────────────────────────
@Schema()
export class Trip {
  _id: Types.ObjectId;
  id: string;
  createdAt: Date;
  updatedAt: Date;

  @Prop({ required: true, ref: 'User', type: Types.ObjectId, index: true })
  owner: Types.ObjectId | UserDocument;

  @Prop({ type: String })
  title?: string;

  @Prop({ required: true, type: String })
  startDate: string;

  @Prop({ required: true, type: String })
  endDate: string;

  @Prop({ required: true, type: Number })
  durationDays: number;

  @Prop({ required: true, type: Number })
  travelers: number;

  @Prop({ required: true, type: Number })
  budgetTotal: number;

  @Prop({ type: Number })
  budgetAccommodation?: number;

  // Optional per-category ceiling, same spirit as budgetAccommodation —
  // advisory, folded into the planner's prompt (AiService.buildProfileMessage).
  @Prop({ type: Number })
  budgetActivities?: number;

  @Prop({ required: true, type: String, default: 'MAD' })
  currency: string;

  @Prop({ required: true, type: [String] })
  cities: string[];

  @Prop({ type: [String], default: [] })
  interests: string[];

  @Prop({ type: [String], default: [] })
  avoid: string[];

  @Prop({ type: String, enum: [...COMFORT_LEVELS, null], default: null })
  comfort: ComfortLevelEnum | null;

  @Prop({ type: String, enum: [...TRANSPORT_MODES, null], default: null })
  transport: TransportModeEnum | null;

  // How many days at each city — only meaningful with 2+ cities; the
  // planner otherwise splits `durationDays` evenly across `cities`. Loosely
  // typed like proposedItinerary/dashboard below: validated at the DTO
  // boundary (CreateTripDto), not re-validated here.
  @Prop({ type: [Object], default: [] })
  cityDurations: CityDuration[];

  // Preferred inter-city carrier (train/bus/taxi) — distinct from `transport`
  // above, which is the in-city moving style. 'any'/unset lets the planner
  // pick the cheapest sourced option (see transport-pricing.util.ts).
  @Prop({ type: String, enum: [...INTERCITY_MODES, null], default: null })
  intercityTransport: IntercityModeEnum | null;

  @Prop({ type: String, enum: [...TRAVELER_TYPES, null], default: null })
  travelerType: TravelerTypeEnum | null;

  @Prop({ required: true, type: Boolean, default: false })
  alreadyInMorocco: boolean;

  @Prop({ type: String, default: null })
  currentCity: string | null;

  @Prop({ type: String, enum: [...PACES, null], default: null })
  pace: PaceEnum | null;

  @Prop({ type: [String], default: [] })
  dietary: string[];

  // Free-text catch-all (allergies, mobility needs, special occasion...),
  // appended verbatim to the planner's prompt — see TripProfileSchema.travelNotes.
  @Prop({ type: String, default: null })
  travelNotes: string | null;

  @Prop({ required: true, type: String, default: 'fr' })
  language: string;

  @Prop({ required: true, type: String, enum: [...TRIP_STATUSES], default: TripStatusEnum.DRAFT, index: true })
  status: TripStatusEnum;

  // Proposal produced by AiService.generateItinerary — set on "generated",
  // superseded once the user confirms a selection into TripActivity docs.
  @Prop({ type: Object, default: null })
  proposedItinerary: Record<string, unknown> | null;

  @Prop({ type: Date, default: null })
  validatedAt: Date | null;

  // DashboardData (§8 Étape G) — filled by DashboardFillerService, never
  // hand-edited. `dashboardVersion` guards against an older fill
  // overwriting a newer one (idempotence rule).
  @Prop({ type: Object, default: null })
  dashboard: Record<string, unknown> | null;

  @Prop({ required: true, type: Number, default: 0 })
  dashboardVersion: number;

  @Prop({ type: Object, default: null })
  aiMeta: { model?: string; generatedAt?: string; pipelineTimings?: Record<string, number> } | null;
}

// ── Factory, settings, indexes, serialization ───────────────────────
export const TripSchema = SchemaFactory.createForClass(Trip);

TripSchema.set('timestamps', true);

TripSchema.index({ owner: 1, createdAt: -1 });
TripSchema.index({ owner: 1, status: 1 });

const serializationCfg = {
  getters: true,
  virtuals: true,
  transform: function (_doc: unknown, ret: Record<string, any>) {
    ret.id = `${ret._id}`;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

TripSchema.set('toJSON', { ...serializationCfg });
TripSchema.set('toObject', { ...serializationCfg });
