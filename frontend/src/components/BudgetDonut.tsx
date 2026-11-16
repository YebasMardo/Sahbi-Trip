import type { BudgetCategory } from '../data/trips'

export default function BudgetDonut({
  categories,
  total,
  size = 132,
}: {
  categories: Array<BudgetCategory & { pct: number }>
  total: number
  size?: number
}) {
  const stroke = 16
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  let offsetAcc = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-sand)" strokeWidth={stroke} />
      {categories.map((cat) => {
        const dash = (cat.pct / 100) * circumference
        const el = (
          <circle
            key={cat.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={cat.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offsetAcc}
            strokeLinecap="butt"
          />
        )
        offsetAcc += dash
        return el
      })}
      <foreignObject x={0} y={0} width={size} height={size}>
        <div className="flex h-full rotate-90 flex-col items-center justify-center text-center">
          <span className="font-display text-base font-extrabold text-ink">{total.toLocaleString('fr-FR')}</span>
          <span className="text-[10px] font-medium text-ink-faint">MAD</span>
        </div>
      </foreignObject>
    </svg>
  )
}
