import { Landmark, Leaf, MapPin, ScrollText, ShoppingBag, UtensilsCrossed, Waves, Footprints, Car } from 'lucide-react'
import type { PlaceImage as PlaceImageType } from '../data/trips'

const PLACEHOLDER_GRADIENTS: Record<string, string> = {
  culture: 'from-primary-200 to-primary-400',
  histoire: 'from-primary-200 to-primary-400',
  nature: 'from-teal-50 to-teal-400',
  gastronomie: 'from-violet-50 to-violet-400',
  shopping: 'from-rose-50 to-rose-400',
  plage: 'from-azure-50 to-azure-400',
  promenade: 'from-teal-50 to-teal-400',
  transport: 'from-ink-faint/30 to-ink-soft/40',
}

const PLACEHOLDER_ICONS: Record<string, typeof MapPin> = {
  culture: Landmark,
  histoire: ScrollText,
  nature: Leaf,
  gastronomie: UtensilsCrossed,
  shopping: ShoppingBag,
  plage: Waves,
  promenade: Footprints,
  transport: Car,
}

// Generic mood shots (Wikimedia Commons, verified + credited) used when a
// specific place has no sourced photo — never presented as the real place,
// always labelled "Illustration" instead of a place credit.
const CATEGORY_FALLBACK_IMAGES: Partial<Record<string, PlaceImageType>> = {
  gastronomie: {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Moroccan_meal_tagine.jpg?width=800',
    credit: 'Kim sosita',
    license: 'CC BY-SA 4.0',
  },
  shopping: {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Marrakech,_Morocco_(5422826266)_(6).jpg?width=800',
    credit: 'YoTuT',
    license: 'CC BY 2.0',
  },
}

export default function PlaceImage({
  image,
  category = 'culture',
  alt,
  className = '',
  showCredit = false,
  iconSize = 26,
}: {
  image: PlaceImageType | null
  category?: string
  alt: string
  className?: string
  showCredit?: boolean
  iconSize?: number
}) {
  const fallback = !image ? CATEGORY_FALLBACK_IMAGES[category] : undefined
  const resolved = image ?? fallback

  if (!resolved) {
    const gradient = PLACEHOLDER_GRADIENTS[category] ?? PLACEHOLDER_GRADIENTS.culture
    const Icon = PLACEHOLDER_ICONS[category] ?? MapPin
    return (
      <div
        className={`grid place-items-center bg-gradient-to-br text-white/80 ${gradient} ${className}`}
        role="img"
        aria-label={alt}
      >
        <Icon size={iconSize} strokeWidth={1.75} />
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={resolved.url} alt={alt} className="size-full object-cover" loading="lazy" />
      {showCredit && (
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
          {fallback ? 'Illustration' : `© ${resolved.credit}`}
        </span>
      )}
    </div>
  )
}
