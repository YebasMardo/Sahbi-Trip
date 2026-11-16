import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

import type { RootState } from '../../store'
import authApiSlice from './auth.apiSlice'
import type { AuthSession, BackendUser, RefreshTokenPair } from './auth.types'
import { clearTokens, writeAccessToken, writeRefreshToken } from './tokenStorage'

interface AuthState {
  user: BackendUser | null
  accessToken: string | null
  refreshToken: RefreshTokenPair | null
  /** Scoped OTP JWT for the in-progress verify-email / reset-password flow.
   *  Never persisted — a page reload loses it by design, same as the flow
   *  itself being tied to a live form. */
  otpToken: string | null
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  otpToken: null,
}

function applySession(state: AuthState, session: AuthSession) {
  state.user = session.user
  state.accessToken = session.accessToken
  state.refreshToken = session.refreshToken
  state.otpToken = null
  writeAccessToken(session.accessToken)
  writeRefreshToken(session.refreshToken)
}

function clearSession(state: AuthState) {
  state.user = null
  state.accessToken = null
  state.refreshToken = null
  state.otpToken = null
  clearTokens()
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<AuthSession>) {
      applySession(state, action.payload)
    },
    setOtpToken(state, action: PayloadAction<string>) {
      state.otpToken = action.payload
    },
    // Boot-time only: seeds tokens already persisted in localStorage into
    // Redux state, ahead of the `me` call that validates them — does not
    // re-persist, they're already on disk.
    hydrateTokens(
      state,
      action: PayloadAction<{ accessToken: string | null; refreshToken: RefreshTokenPair | null }>,
    ) {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
    },
    logout(state) {
      clearSession(state)
    },
  },
  extraReducers(builder) {
    builder
      .addMatcher(authApiSlice.endpoints.register.matchFulfilled, (state, { payload }) => {
        state.otpToken = payload.data.token
      })
      .addMatcher(authApiSlice.endpoints.login.matchFulfilled, (state, { payload }) => {
        if (payload.data.status === 'OK') {
          applySession(state, payload.data)
        } else {
          state.otpToken = payload.data.token
        }
      })
      .addMatcher(authApiSlice.endpoints.verifyEmail.matchFulfilled, (state, { payload }) => {
        applySession(state, payload.data)
      })
      .addMatcher(authApiSlice.endpoints.refreshToken.matchFulfilled, (state, { payload }) => {
        applySession(state, payload.data)
      })
      .addMatcher(authApiSlice.endpoints.forgotPassword.matchFulfilled, (state, { payload }) => {
        state.otpToken = payload.data.token
      })
      .addMatcher(authApiSlice.endpoints.me.matchFulfilled, (state, { payload }) => {
        state.user = payload.data
      })
      .addMatcher(authApiSlice.endpoints.updateProfile.matchFulfilled, (state, { payload }) => {
        state.user = payload.data
      })
      .addMatcher(authApiSlice.endpoints.logout.matchFulfilled, (state) => {
        clearSession(state)
      })
  },
})

export const { setSession, setOtpToken, hydrateTokens, logout } = authSlice.actions

export const selectAuthUser = (state: RootState) => state.auth.user
export const selectOtpToken = (state: RootState) => state.auth.otpToken
export const selectAccessToken = (state: RootState) => state.auth.accessToken
export const selectRefreshToken = (state: RootState) => state.auth.refreshToken

export default authSlice.reducer
