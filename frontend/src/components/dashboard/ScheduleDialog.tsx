import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { findTimeConflict, timeToMinutes, type ActivityItem } from '../../data/trips'
import ScheduleFields from './ScheduleFields'

/** Modal that changes the hours of an activity already in the day. */
export default function ScheduleDialog({
  activity,
  dayActivities,
  onSave,
  onClose,
}: {
  activity: ActivityItem
  dayActivities: ActivityItem[]
  onSave: (startTime: string, endTime: string) => void
  onClose: () => void
}) {
  const [startTime, setStartTime] = useState(activity.startTime)
  const [endTime, setEndTime] = useState(activity.endTime)

  const conflict = findTimeConflict(dayActivities, startTime, endTime, activity.id)
  const isInvalid = timeToMinutes(endTime) <= timeToMinutes(startTime)
  const isUnchanged = startTime === activity.startTime && endTime === activity.endTime

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-card-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/5 p-5">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold text-ink">Modifier les horaires</h3>
            <p className="mt-0.5 truncate text-xs text-ink-soft">{activity.name}</p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-cream hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <p className="mb-3 text-xs text-ink-soft">
            Créneau actuel : <span className="font-semibold text-ink">{activity.startTime} – {activity.endTime}</span>
          </p>
          <ScheduleFields
            startTime={startTime}
            endTime={endTime}
            onChange={(s, e) => {
              setStartTime(s)
              setEndTime(e)
            }}
            conflict={conflict}
          />
        </div>

        <div className="flex items-center gap-3 border-t border-ink/5 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-cream"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isInvalid || isUnchanged}
            onClick={() => onSave(startTime, endTime)}
            className="ml-auto flex items-center gap-2 rounded-full bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={15} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
