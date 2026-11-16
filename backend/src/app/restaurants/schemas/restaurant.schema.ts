import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Coordinates, CoordinatesSchema, ImageStatusEnum, PlaceImage, PlaceImageSchema } from 'src/app/activities/schemas/activity.schema';

export const PRICE_LEVELS = ['$', '$$', '$$$', '$$$$'] as const;

// ── Document type alias ─────────────────────────────────────────────
export type RestaurantDocument = HydratedDocument<Restaurant>;

// ── The schema class ────────────────────────────────────────────────
// Same catalogue pattern as Activity: slug _id, read-only, seeded from
// data/morocco_dataset.json.
@Schema({ _id: false })
export class Restaurant {
  @Prop({ required: true, type: String })
  _id: string;

  id: string; // mirrors _id, produced by the toJSON transform

  @Prop({ required: true, trim: true, type: String })
  name: string;

  @Prop({ required: true, type: String, index: true })
  city: string;

  @Prop({ required: true, type: String })
  cuisine: string;

  @Prop({ required: true, type: String })
  description: string;

  // Dataset gives a price bracket, not a MAD figure — see
  // meta.assumptionsToCalibrate for the $/€ → MAD table used at estimation time.
  @Prop({ type: String, default: null })
  priceLevel: string | null;

  @Prop({ type: Number, default: null })
  avgPricePerPerson: number | null;

  @Prop({ type: String, default: null })
  address: string | null;

  @Prop({ type: String, default: null })
  openingHours: string | null;

  @Prop({ type: String, default: null })
  phone: string | null;

  @Prop({ type: String, default: null })
  email: string | null;

  @Prop({ type: String, default: null })
  website: string | null;

  @Prop({ type: CoordinatesSchema, default: null })
  coordinates: Coordinates | null;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, default: null })
  notes: string | null;

  @Prop({ type: Number, default: null })
  rating: number | null;

  // MVP demo placeholder count, alongside `rating` — see `demoDataFields`.
  @Prop({ type: Number, default: null })
  userRatingCount: number | null;

  // Names the fields on this item that are fabricated demo placeholders, not
  // sourced data (rating/userRatingCount/phone stand in for Google Places
  // until that's wired in). The frontend must badge every field named here
  // and never render it as a live tel:/link action. Empty/absent = nothing
  // fabricated on this item.
  @Prop({ type: [String], default: [] })
  demoDataFields: string[];

  @Prop({ type: String, default: null })
  wikipediaTitle: string | null;

  @Prop({ type: PlaceImageSchema, default: () => ({ status: ImageStatusEnum.NONE }) })
  image: PlaceImage;

  @Prop({ required: true, type: [String] })
  sources: string[];

  @Prop({ required: true, type: String })
  lastChecked: string;

  @Prop({ type: [Number], default: null, select: false })
  embedding: number[] | null;
}

// ── Factory, settings, indexes, serialization ───────────────────────
export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);

RestaurantSchema.index({ city: 1, priceLevel: 1 });

const serializationCfg = {
  getters: true,
  virtuals: true,
  transform: function (_doc: unknown, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.embedding;
    return ret;
  },
};

RestaurantSchema.set('toJSON', { ...serializationCfg });
RestaurantSchema.set('toObject', { ...serializationCfg });
