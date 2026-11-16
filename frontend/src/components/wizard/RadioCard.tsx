import type { LucideIcon } from 'lucide-react'

export default function RadioCard({
  label,
  selected,
  onSelect,
  icon: Icon,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  icon?: LucideIcon
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium transition-colors ${
        selected
          ? 'border-primary-500 bg-primary-50 text-primary-600'
          : 'border-ink/10 bg-white text-ink-soft hover:border-primary-200'
      }`}
    >
      {Icon && <Icon size={18} className={selected ? 'text-primary-500' : 'text-ink-faint'} />}
      {label}
    </button>
  )
}
