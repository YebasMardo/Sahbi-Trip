import { ChevronLeft, ChevronRight, Cloud, Sun } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DayPlan } from '../../data/trips'
import PlaceImage from '../PlaceImage'

export default function DayHeroCarousel({ day }: { day: DayPlan }) {
  const slides = useMemo(() => {
    const fromActivities = day.activities
      .filter((a) => a.image)
      .map((a) => ({ image: a.image!, alt: a.name, category: a.category }))
    const hero = day.heroImage ? [{ image: day.heroImage, alt: day.title, category: 'culture' }] : []
    const all = [...hero, ...fromActivities]
    return all.length > 0 ? all : [{ image: null, alt: day.title, category: 'culture' }]
  }, [day])

  const [index, setIndex] = useState(0)
  const slide = slides[index]

  return (
    <div className="relative h-56 overflow-hidden rounded-2xl shadow-card-lg sm:h-64">
      <PlaceImage
        image={slide.image}
        category={slide.category}
        alt={slide.alt}
        className="size-full"
        showCredit={Boolean(slide.image)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-card backdrop-blur-md">
        {day.weatherLabel === 'Voilé' ? <Cloud size={14} className="text-ink-soft" /> : <Sun size={14} className="text-primary-500" />}
        {day.weatherC}°C
        <span className="font-normal text-ink-faint">{day.weatherLabel}</span>
      </span>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Photo précédente"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            className="absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-card transition-colors hover:bg-white"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Photo suivante"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-card transition-colors hover:bg-white"
          >
            <ChevronRight size={16} />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <span
                key={s.alt + i}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
