import type { CityActivityCount } from '../../data/trips'

const MAX_ROWS = 6

/**
 * Ranks destinations by planned activities. A single measure across
 * categories (cities), so one hue throughout — color here is magnitude, not
 * identity, and the count is direct-labeled at the end of each bar rather
 * than relying on bar length alone.
 */
export default function CityActivityBarChart({ data }: { data: CityActivityCount[] }) {
  const rows = data.slice(0, MAX_ROWS)
  const max = Math.max(...rows.map((r) => r.count), 1)

  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-cream px-3.5 py-6 text-center text-xs text-ink-soft">
        Aucune activité planifiée pour l'instant.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.city} className="group" title={`${row.city} : ${row.count} activité${row.count > 1 ? 's' : ''}`}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-ink">{row.city}</span>
            <span className="font-semibold text-ink-soft">{row.count}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/5">
            <div
              className="h-full rounded-full bg-primary-400 transition-[width] group-hover:bg-primary-500"
              style={{ width: `${Math.max((row.count / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
