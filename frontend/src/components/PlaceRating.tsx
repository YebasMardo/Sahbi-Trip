import { Star } from 'lucide-react'
import DemoDataBadge from './DemoDataBadge'

/** Star rating + review count, with a DemoDataBadge when the value is a fabricated placeholder. */
export default function PlaceRating({
  rating,
  userRatingCount,
  isDemoData,
  className = '',
}: {
  rating: number | null
  userRatingCount?: number | null
  isDemoData: boolean
  className?: string
}) {
  if (rating == null) return null

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="flex items-center gap-1 text-[11px] font-semibold text-ink">
        <Star size={11} className="fill-amber-400 text-amber-400" />
        {rating.toFixed(1)}
        {userRatingCount != null && <span className="font-normal text-ink-faint">({userRatingCount})</span>}
      </span>
      {isDemoData && <DemoDataBadge />}
    </span>
  )
}
