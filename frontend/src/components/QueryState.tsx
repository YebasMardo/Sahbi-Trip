import { AlertTriangle, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Consistent loading / error surfaces for RTK Query reads. Every trip screen
 * fetches from the server now, so these two states are the norm rather than an
 * edge case and are worth rendering deliberately instead of flashing an empty
 * layout.
 */
export function LoadingCard({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="mt-6 flex items-center justify-center gap-2.5 rounded-2xl bg-white p-10 text-sm text-ink-soft shadow-card">
      <Loader2 size={16} className="animate-spin text-primary-500" />
      {label}
    </div>
  )
}

export function ErrorCard({
  title = 'Impossible de charger ces données',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-full bg-rose-100 text-rose-500">
        <AlertTriangle size={18} />
      </span>
      <p className="mt-3 font-display text-sm font-bold text-ink">{title}</p>
      {message && <p className="mt-1 text-xs text-ink-soft">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-600"
        >
          Réessayer
        </button>
      )}
    </div>
  )
}

/** Skeleton grid used while a list of trip cards loads. */
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="h-40 animate-pulse bg-cream" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-2/3 animate-pulse rounded bg-cream" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-cream" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-cream" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Pulls a readable message out of an RTK Query error. The backend's envelope
 * puts the human-facing text in `message` (see core/httpResponse and
 * AllExceptionsFilter), with validation details under `errors`.
 */
export function errorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const data = (error as { data?: unknown }).data
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    const message = (data as { message?: unknown }).message
    if (typeof message === 'string') return message
    if (Array.isArray(message)) return message.join(' ')
  }
  const status = (error as { status?: unknown }).status
  if (status === 'FETCH_ERROR') return 'Serveur injoignable. Vérifiez que le backend tourne.'
  return undefined
}

export function QueryBoundary({
  isLoading,
  error,
  onRetry,
  loadingLabel,
  children,
}: {
  isLoading: boolean
  error: unknown
  onRetry?: () => void
  loadingLabel?: string
  children: ReactNode
}) {
  if (isLoading) return <LoadingCard label={loadingLabel} />
  if (error) return <ErrorCard message={errorMessage(error)} onRetry={onRetry} />
  return <>{children}</>
}
