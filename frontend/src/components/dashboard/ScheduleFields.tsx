import { AlertTriangle, Clock } from 'lucide-react'
import {
  addMinutes,
  durationBetween,
  formatDuration,
  timeToMinutes,
  type ActivityItem,
} from '../../data/trips'

const DURATION_PRESETS = [30, 45, 60, 90, 120, 180]

/**
 * Start / end pickers shared by the "add an activity" flow and the "change the
 * hours" flow. Fully controlled: the parent owns the times.
 */
export default function ScheduleFields({
  startTime,
  endTime,
  onChange,
  conflict,
}: {
  startTime: string
  endTime: string
  onChange: (startTime: string, endTime: string) => void
  conflict: ActivityItem | null
}) {
  const duration = durationBetween(startTime, endTime)
  const isInvalid = timeToMinutes(endTime) <= timeToMinutes(startTime)

  function handleStart(next: string) {
    if (!next) return
    // Keep the duration the traveler already chose when sliding the start time.
    onChange(next, addMinutes(next, duration || 60))
  }

  function handleEnd(next: string) {
    if (!next) return
    onChange(startTime, next)
  }

  function shift(minutes: number) {
    handleStart(addMinutes(startTime, minutes))
  }

  return (
    <div className="rounded-2xl bg-cream p-4">
      <h4 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
        <Clock size={14} className="text-primary-500" /> Choisissez vos horaires
      </h4>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] font-medium text-ink-faint">Début</span>
          <input
            type="time"
            value={startTime}
            step={300}
            onChange={(e) => handleStart(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-primary-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-ink-faint">Fin</span>
          <input
            type="time"
            value={endTime}
            step={300}
            onChange={(e) => handleEnd(e.target.value)}
            className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-ink focus:outline-none ${
              isInvalid ? 'border-rose-300 focus:border-rose-400' : 'border-ink/10 focus:border-primary-400'
            }`}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-ink-faint">Durée</span>
        {DURATION_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(startTime, addMinutes(startTime, preset))}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              duration === preset
                ? 'bg-primary-500 text-white'
                : 'bg-white text-ink-soft hover:bg-primary-50 hover:text-primary-600'
            }`}
          >
            {formatDuration(preset)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-ink-faint">Décaler</span>
        {[-60, -30, -15, 15, 30, 60].map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => shift(minutes)}
            className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600"
          >
            {minutes > 0 ? `+${minutes}` : minutes} min
          </button>
        ))}
      </div>

      {isInvalid ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-600">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          L'heure de fin doit être après l'heure de début.
        </p>
      ) : conflict ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary-50 px-3 py-2 text-[11px] font-medium text-primary-700">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          Ce créneau chevauche « {conflict.name} » ({conflict.startTime} – {conflict.endTime}). Vous pouvez
          quand même valider.
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-ink-faint">
          Créneau libre · {formatDuration(duration)} sur place.
        </p>
      )}
    </div>
  )
}
