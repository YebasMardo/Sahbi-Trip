import type { RefreshTokenPair } from './auth.types'

// Web has no SecureStore — localStorage is the whole-app equivalent here.
// Same function names/shapes as a SecureStore-backed version so callers
// (customBaseQuery.ts) don't care which storage backs them.
export const ACCESS_TOKEN_KEY = 'sahbitrip.auth.access_token'
export const REFRESH_TOKEN_KEY = 'sahbitrip.auth.refresh_token'

export function readAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeAccessToken(value: string): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, value)
  } catch {
    // Best-effort — the session still works in-memory for this tab.
  }
}

export function readRefreshToken(): RefreshTokenPair | null {
  try {
    const raw = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RefreshTokenPair
  } catch {
    return null
  }
}

export function writeRefreshToken(value: RefreshTokenPair): void {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, JSON.stringify(value))
  } catch {
    // Best-effort — the session still works in-memory for this tab.
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
  } catch {
    // nothing to do
  }
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // nothing to do
  }
}
