import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useMeQuery } from '../features/auth/auth.apiSlice'
import { hydrateTokens, selectAccessToken } from '../features/auth/auth.slice'
import { readAccessToken, readRefreshToken } from '../features/auth/tokenStorage'
import { useAppDispatch, useAppSelector } from '../store'

/**
 * Mount-once: seeds Redux with whatever's in localStorage, then validates
 * the session via /me. A dead/expired access token is caught by
 * customBaseQuery.ts's own refresh-or-logout path — nothing extra to do here.
 */
export default function AuthBoot({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector(selectAccessToken)

  useEffect(() => {
    dispatch(hydrateTokens({ accessToken: readAccessToken(), refreshToken: readRefreshToken() }))
  }, [dispatch])

  useMeQuery(undefined, { skip: !accessToken })

  return <>{children}</>
}
