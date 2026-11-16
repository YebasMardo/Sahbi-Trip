import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserDocument } from 'src/app/users/schemas/user.schema';

// ── Enums, each paired with a value array ───────────────────────────
export enum OTPTypeEnum {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
}
export const OTP_TYPES = [
  OTPTypeEnum.EMAIL_VERIFICATION,
  OTPTypeEnum.PASSWORD_RESET,
] as const;

// A 6-digit code with no attempt limit is brute-forceable — cap it.
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_TTL_MINUTES = 10;

// ── Document type alias ─────────────────────────────────────────────
export type OtpDocument = HydratedDocument<Otp>;

// ── The schema class ────────────────────────────────────────────────
@Schema()
export class Otp {
  _id: Types.ObjectId;
  id: string;
  createdAt: Date;
  updatedAt: Date;

  @Prop({ required: true, ref: 'User', type: Types.ObjectId, index: true })
  user: Types.ObjectId | UserDocument;

  @Prop({ required: true, type: String, enum: [...OTP_TYPES] })
  type: OTPTypeEnum;

  @Prop({ required: true, type: String })
  value: string;

  @Prop({ required: true, type: Number, default: 0 })
  attempts: number;

  @Prop({ required: true, type: Date })
  expiresAt: Date;
}

// ── Factory, settings, indexes, serialization ───────────────────────
export const OtpSchema = SchemaFactory.createForClass(Otp);

OtpSchema.set('timestamps', true);

// A new request replaces the old one — one live OTP per user/purpose.
OtpSchema.index({ user: 1, type: 1 }, { unique: true });
// TTL cleanup — Mongo removes the document once expiresAt is in the past.
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const serializationCfg = {
  getters: true,
  virtuals: true,
  transform: function (_doc: unknown, ret: Record<string, any>) {
    ret.id = `${ret._id}`;
    delete ret._id;
    delete ret.__v;
    delete ret.value;
    return ret;
  },
};

OtpSchema.set('toJSON', { ...serializationCfg });
OtpSchema.set('toObject', { ...serializationCfg });
