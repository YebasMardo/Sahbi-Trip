import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { fetchBaseQuery } from '@reduxjs/toolkit/query'

import config from '../config'
import { readAccessToken, readRefreshToken } from '../features/auth/tokenStorage'
import type { AuthSession, RefreshTokenPair } from '../features/auth/auth.types'
import type { RootState } from '.'

/**
 * Backend error envelope for an expired/invalid access token
 * (backend/src/app/auth/guards/auth.guard.ts).
 */
const ACCESS_TOKEN_ERROR_CODE = 'E_UNAUTHORIZED'

interface ApiErrorBody {
  error?: string
}

// Shared across every concurrent 401: the refresh token is single-use
// server-side (TokensService.verifyAndRotate deletes it the moment it is
// verified), so two queries racing to refresh at once would otherwise have
// the second one find its token already consumed and get logged out, even
// though the first refresh just succeeded. Every 401 handler awaits this
// single in-flight attempt instead of starting its own.
let pendingRefresh: Promise<AuthSession | null> | null = null

async function performRefresh(refreshToken: RefreshTokenPair): Promise<AuthSession | null> {
  try {
    const response = await fetch(`${config.apiURL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(refreshToken),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { data: AuthSession }
    return body.data
  } catch {
    return null
  }
}

const baseQuery = fetchBaseQuery({
  baseUrl: config.apiURL,
  prepareHeaders: (headers, api) => {
    // Never override a bearer token a query set explicitly (the OTP-gated
    // endpoints — verify-email, resend-otp, reset-password — carry their own
    // short-lived token, not the session's access token).
    if (!headers.get('Authorization')) {
      const state = api.getState() as RootState
      const accessToken = state.auth.accessToken ?? readAccessToken()
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`)
      }
    }
    headers.set('Accept', 'application/json')
    return headers
  },
})

/**
 * Wraps `baseQuery` with automatic session refresh.
 *
 * NOTE: dispatches raw `{ type }` action objects instead of importing the
 * `auth` slice's action creators — importing `auth.slice.ts` here would close
 * a module cycle (apiSlice → customBaseQuery → auth.slice → auth.apiSlice →
 * apiSlice). The action type strings below must stay in sync with
 * `features/auth/auth.slice.ts`'s reducer names.
 */
export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await baseQuery(args, api, extraOptions)

  const errorBody = result.error?.data as ApiErrorBody | undefined
  if (result.error?.status === 401 && errorBody?.error === ACCESS_TOKEN_ERROR_CODE) {
    // Claimed synchronously, with no `await` between the check and the
    // assignment: whichever concurrent caller gets here first owns the
    // refresh, every other one just awaits the same promise below.
    if (!pendingRefresh) {
      pendingRefresh = (async () => {
        const state = api.getState() as RootState
        const refreshToken = state.auth.refreshToken ?? readRefreshToken()
        if (!refreshToken) return null
        return performRefresh(refreshToken)
      })().finally(() => {
        pendingRefresh = null
      })
    }

    const session = await pendingRefresh
    if (!session) {
      api.dispatch({ type: 'auth/logout' })
      return result
    }

    // `auth/setSession` itself persists the new tokens to localStorage
    // (see `applySession` in auth.slice.ts) — nothing to do here beyond dispatching.
    api.dispatch({ type: 'auth/setSession', payload: session })

    const nextArgs: FetchArgs =
      typeof args === 'string'
        ? { url: args, headers: { Authorization: `Bearer ${session.accessToken}` } }
        : {
            ...args,
            headers: { ...args.headers, Authorization: `Bearer ${session.accessToken}` },
          }

    result = await baseQuery(nextArgs, api, extraOptions)
  }

  return result
}
