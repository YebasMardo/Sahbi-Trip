import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

// ── Enums, each paired with a value array ───────────────────────────
export enum UserRoleEnum {
  USER = 'user',
  ADMIN = 'admin',
}
export const USER_ROLES = [UserRoleEnum.USER, UserRoleEnum.ADMIN] as const;

// ── Document type alias ─────────────────────────────────────────────
export type UserDocument = HydratedDocument<User>;

// ── The schema class ────────────────────────────────────────────────
@Schema()
export class User {
  _id: Types.ObjectId;
  id: string;
  createdAt: Date;
  updatedAt: Date;

  @Prop({ required: true, trim: true, type: String })
  fullname: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    type: String,
  })
  email: string;

  @Prop({ required: true, type: String })
  password: string;

  // ADMIN is never reachable through the public register DTO — see
  // RegisterDto and AuthService.register — only provisioned directly
  // (seed script / manual promotion).
  @Prop({
    required: true,
    type: String,
    enum: [...USER_ROLES],
    default: UserRoleEnum.USER,
  })
  role: UserRoleEnum;

  @Prop({ required: true, type: Boolean, default: false })
  emailVerified: boolean;

  @Prop({ type: String })
  avatarUrl?: string;

  // Banned accounts are rejected at login (AuthService.login) and on every
  // subsequent authenticated request (AuthGuard.checkFullGuard) — the ban
  // takes effect immediately, not just once the current token expires.
  @Prop({ required: true, type: Boolean, default: false })
  banned: boolean;
}

// ── Factory, settings, indexes, serialization ───────────────────────
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('timestamps', true);

const serializationCfg = {
  getters: true,
  virtuals: true,
  transform: function (_doc: unknown, ret: Record<string, any>) {
    ret.id = `${ret._id}`;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
};

UserSchema.set('toJSON', { ...serializationCfg });
UserSchema.set('toObject', { ...serializationCfg });
