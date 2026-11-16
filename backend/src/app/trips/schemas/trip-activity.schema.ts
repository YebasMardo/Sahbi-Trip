import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserDocument } from 'src/app/users/schemas/user.schema';
import { TripDocument } from './trip.schema';

// ── Enums, each paired with a value array ───────────────────────────
export enum TripItemTypeEnum {
  ACTIVITY = 'activity',
  RESTAURANT = 'restaurant',
  ACCOMMODATION = 'accommodation',
  TRANSPORT = 'transport',
}
export const TRIP_ITEM_TYPES = Object.values(TripItemTypeEnum);

// Tracks where the traveler stands with *visiting* the place. Replacing an item
// is an action on the itinerary, not a state of the visit, so it is not listed
// here — a replacement is a new item that starts back at TO_VISIT.
export enum TripItemStatusEnum {
  TO_VISIT = 'to_visit',
  CONFIRMED = 'confirmed',
  VISITED = 'visited',
  MISSED = 'missed',
}
export const TRIP_ITEM_STATUSES = Object.values(TripItemStatusEnum);

// ── Document type alias ─────────────────────────────────────────────
export type TripActivityDocument = HydratedDocument<TripActivity>;

// ── The schema class ────────────────────────────────────────────────
@Schema()
export class TripActivity {
  _id: Types.ObjectId;
  id: string;
  createdAt: Date;
  updatedAt: Date;

  @Prop({ required: true, ref: 'Trip', type: Types.ObjectId, index: true })
  trip: Types.ObjectId | TripDocument;

  // Denormalised (DB7) — every ownership check and "my items" query hits
  // this collection alone, no join back through Trip.
  @Prop({ required: true, ref: 'User', type: Types.ObjectId, index: true })
  owner: Types.ObjectId | UserDocument;

  @Prop({ required: true, type: String, enum: [...TRIP_ITEM_TYPES] })
  type: TripItemTypeEnum;

  // References the catalogue row's slug _id (Activity or Restaurant),
  // never an ObjectId — see activity.schema.ts / restaurant.schema.ts.
  // For type TRANSPORT there is no catalogue row: refId is a free-text
  // descriptive label instead (e.g. "Marrakech → Casablanca en train").
  @Prop({ required: true, type: String })
  refId: string;

  @Prop({ required: true, type: Number })
  day: number;

  @Prop({ required: true, type: String })
  city: string;

  @Prop({ type: String, default: null })
  startTime: string | null;

  @Prop({ type: Number, default: null })
  durationMin: number | null;

  @Prop({ required: true, type: String, enum: [...TRIP_ITEM_STATUSES], default: TripItemStatusEnum.TO_VISIT })
  status: TripItemStatusEnum;

  @Prop({ type: String, default: null })
  notes: string | null;

  @Prop({ type: String, default: null })
  reason: string | null;

  @Prop({ type: Number, default: null })
  matchScore: number | null;

  @Prop({ type: Number, default: null })
  estimatedCost: number | null;

  @Prop({ required: true, type: Boolean, default: false })
  costIsEstimate: boolean;

  @Prop({ type: String, enum: ['high', 'medium', 'low', null], default: null })
  priceConfidence: string | null;
}

// ── Factory, settings, indexes, serialization ───────────────────────
export const TripActivitySchema = SchemaFactory.createForClass(TripActivity);

TripActivitySchema.set('timestamps', true);

TripActivitySchema.index({ trip: 1, day: 1 });
TripActivitySchema.index({ owner: 1, createdAt: -1 });

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

TripActivitySchema.set('toJSON', { ...serializationCfg });
TripActivitySchema.set('toObject', { ...serializationCfg });
