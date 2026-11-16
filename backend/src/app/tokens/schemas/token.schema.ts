import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserDocument } from 'src/app/users/schemas/user.schema';

// ── Document type alias ─────────────────────────────────────────────
export type TokenDocument = HydratedDocument<Token>;

// ── The schema class ────────────────────────────────────────────────
@Schema()
export class Token {
  _id: Types.ObjectId;
  id: string;
  createdAt: Date;
  updatedAt: Date;

  @Prop({ required: true, ref: 'User', type: Types.ObjectId, index: true })
  user: Types.ObjectId | UserDocument;

  @Prop({ required: true, type: String })
  value: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;
}

// ── Factory, settings, indexes, serialization ───────────────────────
export const TokenSchema = SchemaFactory.createForClass(Token);

TokenSchema.set('timestamps', true);

// TTL cleanup — Mongo removes the document once expiresAt is in the past.
TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

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

TokenSchema.set('toJSON', { ...serializationCfg });
TokenSchema.set('toObject', { ...serializationCfg });
