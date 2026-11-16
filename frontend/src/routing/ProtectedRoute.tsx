import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { selectAccessToken } from '../features/auth/auth.slice'
import { useAppSelector } from '../store'

/**
 * Redirects to /login, carrying the page the traveler was trying to reach
 * so LoginPage (via SignupPage/VerifyEmailPage) can send them there instead
 * of always landing on /dashboard — see auth pages' `location.state.from`.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const accessToken = useAppSelector(selectAccessToken)
  const location = useLocation()
  if (!accessToken) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}
