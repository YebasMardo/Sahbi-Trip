import { apiSlice } from '../../store/apiSlice'
import type { ApiResponse } from '../../store/apiSlice'
import type {
  AuthSession,
  BackendUser,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  ForgotPasswordResult,
  LoginPayload,
  LoginResult,
  LogoutPayload,
  MessageResult,
  OtpPending,
  RefreshTokenPayload,
  RegisterPayload,
  ResendOtpPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
  VerifyEmailPayload,
} from './auth.types'

/**
 * Endpoint paths and payload shapes mirror backend/src/app/auth/auth.controller.ts
 * exactly.
 */
const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    register: build.mutation<ApiResponse<OtpPending>, RegisterPayload>({
      query(body) {
        return { url: '/auth/register', method: 'POST', body }
      },
    }),

    login: build.mutation<ApiResponse<LoginResult>, LoginPayload>({
      query(body) {
        return { url: '/auth/login', method: 'POST', body }
      },
    }),

    // OTP-gated: the token authorises the flow, the target user comes from
    // its `email` claim — never send an email/id in the body.
    verifyEmail: build.mutation<ApiResponse<AuthSession>, VerifyEmailPayload>({
      query({ token, code }) {
        return {
          url: '/auth/verify-email',
          method: 'POST',
          body: { code },
          headers: { Authorization: `Bearer ${token}` },
        }
      },
    }),

    resendOtp: build.mutation<ApiResponse<MessageResult>, ResendOtpPayload>({
      query({ token }) {
        return {
          url: '/auth/resend-otp',
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      },
    }),

    forgotPassword: build.mutation<ApiResponse<ForgotPasswordResult>, ForgotPasswordPayload>({
      query(body) {
        return { url: '/auth/forgot-password', method: 'POST', body }
      },
    }),

    resetPassword: build.mutation<ApiResponse<MessageResult>, ResetPasswordPayload>({
      query({ token, ...body }) {
        return {
          url: '/auth/reset-password',
          method: 'POST',
          body,
          headers: { Authorization: `Bearer ${token}` },
        }
      },
    }),

    // Public route (no bearer needed) — id/value travel in the body, not headers.
    refreshToken: build.mutation<ApiResponse<AuthSession>, RefreshTokenPayload>({
      query(body) {
        return { url: '/auth/refresh-token', method: 'POST', body }
      },
    }),

    me: build.query<ApiResponse<BackendUser>, void>({
      query: () => ({ url: '/auth/me', method: 'GET' }),
      providesTags: ['Me'],
    }),

    changePassword: build.mutation<ApiResponse<MessageResult>, ChangePasswordPayload>({
      query(body) {
        return { url: '/auth/change-password', method: 'POST', body }
      },
    }),

    updateProfile: build.mutation<ApiResponse<BackendUser>, UpdateProfilePayload>({
      query(body) {
        return { url: '/auth/me', method: 'PATCH', body }
      },
    }),

    logout: build.mutation<ApiResponse<MessageResult>, LogoutPayload>({
      query(body) {
        return { url: '/auth/logout', method: 'POST', body }
      },
    }),
  }),
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useVerifyEmailMutation,
  useResendOtpMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useRefreshTokenMutation,
  useMeQuery,
  useLazyMeQuery,
  useChangePasswordMutation,
  useUpdateProfileMutation,
  useLogoutMutation,
} = authApiSlice

export default authApiSlice
