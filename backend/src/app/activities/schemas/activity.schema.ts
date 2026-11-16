import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// ── Enums, each paired with a value array ───────────────────────────
export enum ActivityCategoryEnum {
  NATURE = 'nature',
  CULTURE = 'culture',
  HISTOIRE = 'histoire',
  PLAGE = 'plage',
  SHOPPING = 'shopping',
  MEDINA = 'medina',
  PARC = 'parc',
  ZOO = 'zoo',
  PARC_ATTRACTIONS = 'parc-attractions',
  PLACE = 'place',
  PROMENADE = 'promenade',
}
export const ACTIVITY_CATEGORIES = Object.values(ActivityCategoryEnum);

export enum TouristLevelEnum {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
export const TOURIST_LEVELS = Object.values(TouristLevelEnum);

export enum PriceConfidenceEnum {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}
export const PRICE_CONFIDENCES = Object.values(PriceConfidenceEnum);

export enum ImageStatusEnum {
  TODO = 'todo',
  AUTO = 'auto',
  AUTO_REVIEW = 'auto-review',
  ILLUSTRATIVE = 'illustrative',
  MANUAL = 'manual',
  NONE = 'none',
}
export const IMAGE_STATUSES = Object.values(ImageStatusEnum);

// ── Embedded sub-schemas ─────────────────────────────────────────────
@Schema({ _id: false })
export class Coordinates {
  @Prop({ required: true, type: Number })
  lat: number;

  @Prop({ required: true, type: Number })
  lng: number;

  @Prop({ type: String, enum: ['approx', 'source'] })
  precision?: string;
}
export const CoordinatesSchema = SchemaFactory.createForClass(Coordinates);

@Schema({ _id: false })
export class PlaceImage {
  @Prop({ type: String, default: null })
  url: string | null;

  @Prop({ type: String, default: null })
  thumbnailUrl: string | null;

  @Prop({ type: String, default: null })
  credit: string | null;

  @Prop({ type: String, default: null })
  license: string | null;

  @Prop({ type: String, default: null })
  licenseUrl: string | null;

  @Prop({ type: String, default: null })
  sourceUrl: string | null;

  @Prop({ type: String, enum: [...IMAGE_STATUSES], default: ImageStatusEnum.TODO })
  status: ImageStatusEnum;

  @Prop({ type: Boolean, default: false })
  isIllustrative?: boolean;

  @Prop({ type: String, default: null })
  unsplashId?: string | null;

  @Prop({ type: String, default: null })
  unsplashQuery?: string | null;

  // Free-form: reason + rejected source, when the enrichment script rejected a match.
  @Prop({ type: Object, default: null })
  rejected?: Record<string, unknown> | null;
}
export const PlaceImageSchema = SchemaFactory.createForClass(PlaceImage);

// ── Document type alias ─────────────────────────────────────────────
export type ActivityDocument = HydratedDocument<Activity>;

// ── The schema class ────────────────────────────────────────────────
// _id is the dataset's human-readable slug (e.g. "marrakech-jardin-majorelle"),
// not an ObjectId — this collection is a read-only catalogue seeded from
// data/morocco_dataset.json, never created through the API.
@Schema({ _id: false })
export class Activity {
  @Prop({ required: true, type: String })
  _id: string;

  id: string; // mirrors _id, produced by the toJSON transform

  @Prop({ required: true, trim: true, type: String })
  name: string;

  @Prop({ required: true, type: String, index: true })
  city: string;

  @Prop({ required: true, type: String, enum: [...ACTIVITY_CATEGORIES], index: true })
  category: ActivityCategoryEnum;

  @Prop({ required: true, type: String })
  description: string;

  // MAD, adult foreigner rate. null = not sourced — never guessed (§11.3).
  @Prop({ type: Number, default: null })
  price: number | null;

  @Prop({ type: [Number], default: null })
  priceRange: [number, number] | null;

  @Prop({ type: String, default: null })
  priceUnit: string | null;

  @Prop({ type: String, default: null })
  priceNote: string | null;

  @Prop({ type: String, enum: [...PRICE_CONFIDENCES, null], default: null })
  priceConfidence: PriceConfidenceEnum | null;

  @Prop({ required: true, type: Boolean, index: true })
  isFree: boolean;

  @Prop({ type: Number, default: null })
  duration: number | null; // minutes

  @Prop({ type: String, enum: ['source', 'estimate', null], default: null })
  durationBasis: string | null;

  @Prop({ type: String, default: null })
  openingHours: string | null;

  @Prop({ type: String, default: null })
  address: string | null;

  @Prop({ type: String, default: null })
  website: string | null;

  @Prop({ type: String, default: null })
  phone: string | null;

  @Prop({ type: CoordinatesSchema, default: null })
  coordinates: Coordinates | null;

  @Prop({ required: true, type: String, enum: [...TOURIST_LEVELS], index: true })
  touristLevel: TouristLevelEnum;

  @Prop({ required: true, type: Boolean })
  requiresBooking: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, default: null })
  notes: string | null;

  // Not alimented in the MVP dataset — never invented (§10).
  @Prop({ type: Number, default: null })
  popularity: number | null;

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

  // Computed at seed time by embedding the descriptive text through
  // Voyage AI voyage-4, pinned to 1024 dimensions to match the Atlas vector
  // index. Absent until `npm run seed` has run with VOYAGE_API_KEY set.
  @Prop({ type: [Number], default: null, select: false })
  embedding: number[] | null;
}

// ── Factory, settings, indexes, serialization ───────────────────────
export const ActivitySchema = SchemaFactory.createForClass(Activity);

// No timestamps: this is a versionless catalogue snapshot re-seeded from
// the dataset file, not a user-created record.

ActivitySchema.index({ city: 1, category: 1 });
ActivitySchema.index({ city: 1, isFree: 1 });
ActivitySchema.index({ city: 1, touristLevel: 1 });

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

ActivitySchema.set('toJSON', { ...serializationCfg });
ActivitySchema.set('toObject', { ...serializationCfg });
