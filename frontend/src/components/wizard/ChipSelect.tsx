export default function ChipSelect({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        selected
          ? 'border-primary-500 bg-primary-500 text-white shadow-card'
          : 'border-ink/10 bg-white text-ink-soft hover:border-primary-300 hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}
