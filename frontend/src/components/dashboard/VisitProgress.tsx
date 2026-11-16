import { CheckCircle2 } from 'lucide-react'
import { ACTIVITY_STATUS_LABELS, type ActivityItemStatus, type VisitProgress } from '../../data/trips'

/** Segment colors, in the order the bar stacks them. */
const SEGMENTS: Array<{ status: ActivityItemStatus; key: keyof VisitProgress; bar: string; dot: string }> = [
  { status: 'visited', key: 'visited', bar: 'bg-teal-400', dot: 'bg-teal-400' },
  { status: 'confirmed', key: 'confirmed', bar: 'bg-primary-400', dot: 'bg-primary-400' },
  { status: 'to_visit', key: 'toVisit', bar: 'bg-ink/15', dot: 'bg-ink/20' },
  { status: 'missed', key: 'missed', bar: 'bg-rose-400', dot: 'bg-rose-400' },
]

export function VisitProgressBar({ progress, className = '' }: { progress: VisitProgress; className?: string }) {
  const total = progress.total
  return (
    <div className={`flex h-2 w-full overflow-hidden rounded-full bg-ink/5 ${className}`}>
      {total > 0 &&
        SEGMENTS.map((s) => {
          const count = progress[s.key] as number
          if (count === 0) return null
          return (
            <span
              key={s.status}
              className={s.bar}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${ACTIVITY_STATUS_LABELS[s.status]} : ${count}`}
            />
          )
        })}
    </div>
  )
}

/**
 * Progress of the visits. Used for a single day and for the whole trip —
 * `subtitle` says which.
 */
export default function VisitProgressCard({
  title,
  subtitle,
  progress,
  className = '',
}: {
  title: string
  subtitle?: string
  progress: VisitProgress
  className?: string
}) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-card ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
            <CheckCircle2 size={15} className="text-teal-500" /> {title}
          </h4>
          {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-extrabold leading-none text-ink">{progress.percentVisited}%</p>
          <p className="mt-1 text-[11px] text-ink-faint">
            {progress.visited}/{progress.total} visité{progress.visited > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <VisitProgressBar progress={progress} className="mt-4" />

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
        {SEGMENTS.map((s) => (
          <span key={s.status} className="flex items-center gap-1.5 text-ink-soft">
            <span className={`size-2 shrink-0 rounded-full ${s.dot}`} />
            <span className="truncate">{ACTIVITY_STATUS_LABELS[s.status]}</span>
            <span className="ml-auto font-semibold text-ink">{progress[s.key] as number}</span>
          </span>
        ))}
      </div>

      {progress.total === 0 && (
        <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-[11px] text-ink-soft">
          Aucune activité pour l'instant — ajoutez-en une pour suivre votre progression.
        </p>
      )}
    </div>
  )
}
