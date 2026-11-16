import { AlertTriangle, Check } from 'lucide-react'
import { useCallback, useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { errorMessage } from './QueryState'

export type ActionStatus =
  | { phase: 'loading'; text: string; orb: OrbState }
  | { phase: 'success'; text: string }
  | { phase: 'error'; text: string }

export type ActionRunResult<T> = { ok: true; value: T } | { ok: false }

/**
 * One modal for every mutation across the dashboard (optimize, validate,
 * add/replace/delete an activity, adapt budget, …): the orb while the request
 * is in flight, then a dismissible success or error card. Mirrors the wizard's
 * `GeneratingScreen` so "the AI is working" always looks the same, instead of
 * each screen inventing its own inline spinner/banner.
 */
export function useActionStatus() {
  const [status, setStatus] = useState<ActionStatus | null>(null)

  const run = useCallback(async function run<T>(
    action: () => Promise<T>,
    opts: { loading: string; orb?: OrbState; success: string | ((value: T) => string); error?: string },
  ): Promise<ActionRunResult<T>> {
    setStatus({ phase: 'loading', text: opts.loading, orb: opts.orb ?? 'working' })
    try {
      const value = await action()
      setStatus({ phase: 'success', text: typeof opts.success === 'function' ? opts.success(value) : opts.success })
      return { ok: true, value }
    } catch (e) {
      setStatus({ phase: 'error', text: errorMessage(e) ?? opts.error ?? 'Une erreur est survenue.' })
      return { ok: false }
    }
  }, [])

  const close = useCallback(() => setStatus(null), [])

  return { status, run, close }
}

export default function ActionStatusModal({ status, onClose }: { status: ActionStatus; onClose: () => void }) {
  const dismissible = status.phase !== 'loading'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        className="flex w-full max-w-xs flex-col items-center gap-4 rounded-3xl bg-white p-7 text-center shadow-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {status.phase === 'loading' && (
          <ThinkingOrb state={status.orb} size={64} theme="light" aria-label={status.text} />
        )}
        {status.phase === 'success' && (
          <span className="grid size-14 place-items-center rounded-2xl bg-teal-500 text-white shadow-card">
            <Check size={26} />
          </span>
        )}
        {status.phase === 'error' && (
          <span className="grid size-14 place-items-center rounded-2xl bg-rose-500 text-white shadow-card">
            <AlertTriangle size={26} />
          </span>
        )}

        <p className="text-sm font-medium text-ink">{status.text}</p>

        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
          >
            OK
          </button>
        )}
      </div>
    </div>
  )
}
