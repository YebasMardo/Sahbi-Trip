import { Check } from 'lucide-react'

export default function WizardProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? 'bg-primary-500 text-white'
                    : active
                      ? 'bg-primary-100 text-primary-600 ring-2 ring-primary-400'
                      : 'bg-white text-ink-faint ring-1 ring-ink/10'
                }`}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span className={`hidden text-center text-[11px] font-medium sm:block ${active ? 'text-ink' : 'text-ink-faint'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={`mx-2 h-px flex-1 ${done ? 'bg-primary-400' : 'bg-ink/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
