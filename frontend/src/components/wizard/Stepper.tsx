import { Minus, Plus } from 'lucide-react'

export default function Stepper({
  value,
  onChange,
  min = 1,
  max = 12,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <div className="inline-flex items-center gap-4 rounded-full border border-ink/10 bg-white px-2 py-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-cream disabled:opacity-30"
        aria-label="Diminuer"
      >
        <Minus size={15} />
      </button>
      <span className="min-w-[3.5rem] text-center font-display text-lg font-bold text-ink">
        {value}
        {suffix && <span className="ml-1 text-xs font-medium text-ink-faint">{suffix}</span>}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-cream disabled:opacity-30"
        aria-label="Augmenter"
      >
        <Plus size={15} />
      </button>
    </div>
  )
}
