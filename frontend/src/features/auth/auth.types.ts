/**
 * Types mirroring the backend's auth contract exactly (backend/src/app/auth/**).
 * Every user is plain 'user' — Sahbi Trip has no role/pseudo/account-type
 * fields on register, unlike some other apps' auth module.
 */

/** What backend/src/app/users/schemas/user.schema.ts serializes via toJSON. */
export interface BackendUser {
  id: string
  fullname: string
  email: string
  role: 'user' | 'admin'
  emailVerified: boolean
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export interface RefreshTokenPair {
  id: string
  value: string
}

/** AuthStatusEnum.OK branch of backend/src/app/auth/types/jwt-token-payload.ts. */
export interface AuthSession {
  status: 'OK'
  accessToken: string
  refreshToken: RefreshTokenPair
  user: BackendUser
}

/** AuthStatusEnum.EMAIL_VERIFICATION_PENDING branch — carries a scoped OTP JWT. */
export interface OtpPending {
  status: 'EMAIL_VERIFICATION_PENDING'
  token: string
}

/** login() returns either branch — register() always returns OtpPending. */
export type LoginResult = AuthSession | OtpPending

export interface RegisterPayload {
  fullname: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface VerifyEmailPayload {
  token: string
  code: string
}

export interface ResendOtpPayload {
  token: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ForgotPasswordResult {
  message: string
  token: string
}

export interface ResetPasswordPayload {
  token: string
  code: string
  password: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

/** Mirrors backend/src/app/auth/dto/update-profile.dto.ts — every field optional. */
export interface UpdateProfilePayload {
  fullname?: string
  email?: string
  avatarUrl?: string
}

export type RefreshTokenPayload = RefreshTokenPair

export type LogoutPayload = RefreshTokenPair

export interface MessageResult {
  message: string
}
