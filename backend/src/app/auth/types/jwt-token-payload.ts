import { UserRoleEnum } from 'src/app/users/schemas/user.schema';
import { OTPTypeEnum } from '../schemas/otp.schema';

export interface FullTokenPayload {
  sub: string; // user id
  role: UserRoleEnum;
  ok: boolean; // emailVerified
}

export interface OTPTokenPayload {
  sub: OTPTypeEnum; // which flow this token authorises
  email: string;
}

export type JwtTokenPayload = FullTokenPayload | OTPTokenPayload;

export enum AuthStatusEnum {
  OK = 'OK',
  EMAIL_VERIFICATION_PENDING = 'EMAIL_VERIFICATION_PENDING',
}
