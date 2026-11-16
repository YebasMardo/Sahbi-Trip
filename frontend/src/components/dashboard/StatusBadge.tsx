import type { TripStatus } from '../../data/trips'

const STATUS_STYLES: Record<TripStatus, { label: string; className: string }> = {
  draft: { label: 'Proposition IA', className: 'bg-violet-50 text-violet-500' },
  confirmed: { label: 'Confirmé', className: 'bg-teal-50 text-teal-500' },
  completed: { label: 'Terminé', className: 'bg-ink/5 text-ink-soft' },
}

export default function StatusBadge({ status }: { status: TripStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}
