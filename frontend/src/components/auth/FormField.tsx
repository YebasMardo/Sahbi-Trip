import type { InputHTMLAttributes } from 'react'

export default function FormField({
  label,
  error,
  ...inputProps
}: {
  label: string
  error?: string
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      <input
        {...inputProps}
        className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint/70 focus:outline-none ${
          error ? 'border-rose-400 focus:border-rose-400' : 'border-ink/10 focus:border-primary-400'
        }`}
      />
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </label>
  )
}
