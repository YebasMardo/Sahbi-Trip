import { SetMetadata } from '@nestjs/common';
import { OTPTypeEnum } from '../schemas/otp.schema';

export const OTP_JWT_SUB_DECORATOR_KEY = 'auth:otp-jwt-sub';
export const OTPJwtSub = (...handler: OTPTypeEnum[]) =>
  SetMetadata(OTP_JWT_SUB_DECORATOR_KEY, handler);
