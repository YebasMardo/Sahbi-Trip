import { ArrowLeft, Check, Clock, Loader2, MapPin, Search, Wallet, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  findTimeConflict,
  formatDuration,
  formatMAD,
  suggestSlot,
  timeToMinutes,
  type ActivityItem,
} from '../../data/trips'
import { useListActivitiesQuery, useListRestaurantsQuery } from '../../features/trips/trips.apiSlice'
import type {
  CatalogueActivity,
  CatalogueRestaurant,
  PickerKindFilter,
  PickerPlace,
} from '../../features/trips/trips.types'
import { AVAILABLE_CITIES } from '../../features/trips/wizard'
import PlaceImage from '../PlaceImage'
import PlaceRating from '../PlaceRating'
import ScheduleFields from './ScheduleFields'

const KIND_FILTERS: Array<{ key: PickerKindFilter; label: string }> = [
  { key: 'all', label: 'Tout' },
  { key: 'activity', label: 'Activités' },
  { key: 'restaurant', label: 'Restaurants' },
]

const PAGE_SIZE = 40

/** Catalogue activity → the shape the picker list and the add/replace calls need. */
function activityToPlace(a: CatalogueActivity): PickerPlace {
  return {
    refId: a.id,
    type: 'activity',
    name: a.name,
    city: a.city,
    category: a.category,
    description: a.description,
    durationMin: a.duration ?? 60,
    price: a.price,
    isFree: a.isFree,
    image: a.image?.url ? { url: a.image.url, credit: a.image.credit ?? '', license: a.image.license ?? '' } : null,
    rating: a.rating,
    userRatingCount: a.userRatingCount,
    demoDataFields: a.demoDataFields,
  }
}

function restaurantToPlace(r: CatalogueRestaurant): PickerPlace {
  return {
    refId: r.id,
    type: 'restaurant',
    name: r.name,
    city: r.city,
    category: 'gastronomie',
    description: r.description,
    durationMin: 60,
    price: r.avgPricePerPerson,
    isFree: false,
    image: r.image?.url ? { url: r.image.url, credit: r.image.credit ?? '', license: r.image.license ?? '' } : null,
    priceLevel: r.priceLevel,
    rating: r.rating,
    userRatingCount: r.userRatingCount,
    demoDataFields: r.demoDataFields,
  }
}

function priceText(place: PickerPlace): string {
  if (place.isFree) return 'Gratuit'
  if (place.price != null) return formatMAD(place.price)
  if (place.priceLevel) return `Niveau ${place.priceLevel}`
  return 'Non renseigné'
}

/**
 * Two-step picker: choose a catalogue place that is not already in the day,
 * then choose the hours. Used for both "ajouter" and "remplacer".
 *
 * The list comes from the live catalogue (`GET /activities`, `GET /restaurants`)
 * — searching and city filtering happen server-side so the picker sees the
 * whole dataset, not just what the current trip already references.
 */
export default function ActivityPicker({
  title,
  city,
  dayActivities,
  excludeNames,
  initialSchedule,
  ignoreActivityId,
  confirmLabel = 'Ajouter au programme',
  onConfirm,
  onClose,
  isSubmitting = false,
}: {
  title: string
  city: string
  /** Activities already in the day — used to detect overlapping slots. */
  dayActivities: ActivityItem[]
  /** Names already in the day: they never show up in the catalogue list. */
  excludeNames: string[]
  /** Pre-filled hours (replace keeps the slot of the activity it replaces). */
  initialSchedule?: { startTime: string; endTime: string }
  /** Activity being replaced — its own slot is not a conflict. */
  ignoreActivityId?: string
  confirmLabel?: string
  onConfirm: (place: PickerPlace, schedule: { startTime: string; endTime: string }) => void
  onClose: () => void
  isSubmitting?: boolean
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<PickerKindFilter>('all')
  const [cityFilter, setCityFilter] = useState<string>(city)
  const [selected, setSelected] = useState<PickerPlace | null>(null)
  const [startTime, setStartTime] = useState(initialSchedule?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initialSchedule?.endTime ?? '10:00')

  const cityParam = cityFilter === 'all' ? undefined : cityFilter
  const activitiesResult = useListActivitiesQuery(
    { city: cityParam, query: query.trim() || undefined, limit: PAGE_SIZE },
    { skip: kind === 'restaurant' },
  )
  const restaurantsResult = useListRestaurantsQuery(
    { city: cityParam, query: query.trim() || undefined, limit: PAGE_SIZE },
    { skip: kind === 'activity' },
  )

  const isLoading = activitiesResult.isFetching || restaurantsResult.isFetching
  const loadError = activitiesResult.error ?? restaurantsResult.error

  const options = useMemo(() => {
    const places: PickerPlace[] = []
    if (kind !== 'restaurant') {
      places.push(...(activitiesResult.data?.data.items ?? []).map(activityToPlace))
    }
    if (kind !== 'activity') {
      places.push(...(restaurantsResult.data?.data.items ?? []).map(restaurantToPlace))
    }
    const excluded = new Set(excludeNames)
    return places.filter((p) => !excluded.has(p.name))
  }, [kind, activitiesResult.data, restaurantsResult.data, excludeNames])

  const conflict = selected ? findTimeConflict(dayActivities, startTime, endTime, ignoreActivityId) : null
  const isInvalid = timeToMinutes(endTime) <= timeToMinutes(startTime)

  function handleSelect(place: PickerPlace) {
    setSelected(place)
    if (initialSchedule) {
      // Replace: keep the slot already booked, the traveler can still move it.
      setStartTime(initialSchedule.startTime)
      setEndTime(initialSchedule.endTime)
      return
    }
    const slot = suggestSlot(dayActivities, place.durationMin)
    setStartTime(slot.startTime)
    setEndTime(slot.endTime)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-card-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/5 p-5 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {selected && (
                <button
                  type="button"
                  aria-label="Revenir à la liste"
                  onClick={() => setSelected(null)}
                  className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-cream hover:text-ink"
                >
                  <ArrowLeft size={15} />
                </button>
              )}
              <h3 className="truncate font-display text-lg font-bold text-ink">{selected ? selected.name : title}</h3>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              {selected
                ? 'Étape 2 sur 2 — choisissez vos horaires'
                : isLoading
                  ? 'Étape 1 sur 2 — chargement du catalogue…'
                  : `Étape 1 sur 2 — ${options.length} lieu${options.length > 1 ? 'x' : ''} disponible${options.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-cream hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {selected ? (
          <div className="flex-1 overflow-y-auto p-5 sm:px-6">
            <div className="flex items-center gap-3.5 rounded-2xl border border-primary-300/40 bg-primary-50/40 p-3">
              <PlaceImage
                image={selected.image}
                category={selected.category}
                alt={selected.name}
                className="size-16 shrink-0 rounded-xl"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{selected.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{selected.description}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint">
                  <MapPin size={11} /> {selected.city} · durée conseillée {formatDuration(selected.durationMin)}
                </p>
                <PlaceRating
                  rating={selected.rating}
                  userRatingCount={selected.userRatingCount}
                  isDemoData={selected.demoDataFields?.includes('rating') ?? false}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="mt-4">
              <ScheduleFields
                startTime={startTime}
                endTime={endTime}
                onChange={(s, e) => {
                  setStartTime(s)
                  setEndTime(e)
                }}
                conflict={conflict}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-ink/5 px-5 pb-4 sm:px-6">
              <label className="relative block">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un lieu, une catégorie…"
                  className="w-full rounded-xl border border-ink/10 bg-cream py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary-400 focus:bg-white focus:outline-none"
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {KIND_FILTERS.map((f) => (
                  <FilterChip key={f.key} active={kind === f.key} onClick={() => setKind(f.key)}>
                    {f.label}
                  </FilterChip>
                ))}
                <span className="mx-1 h-4 w-px bg-ink/10" />
                {AVAILABLE_CITIES.map((c) => (
                  <FilterChip key={c} active={cityFilter === c} onClick={() => setCityFilter(c)}>
                    {c}
                  </FilterChip>
                ))}
                <FilterChip active={cityFilter === 'all'} onClick={() => setCityFilter('all')}>
                  Toutes
                </FilterChip>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:px-6">
              {isLoading && options.length === 0 ? (
                <p className="flex items-center justify-center gap-2 rounded-2xl bg-cream px-4 py-6 text-center text-sm text-ink-soft">
                  <Loader2 size={14} className="animate-spin" /> Chargement du catalogue…
                </p>
              ) : loadError ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-6 text-center text-sm text-rose-600">
                  Le catalogue n'a pas pu être chargé.
                </p>
              ) : options.length === 0 ? (
                <p className="rounded-2xl bg-cream px-4 py-6 text-center text-sm text-ink-soft">
                  Aucun lieu ne correspond. Élargissez la recherche ou changez de ville.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {options.map((place) => (
                    <button
                      key={`${place.type}-${place.refId}`}
                      type="button"
                      onClick={() => handleSelect(place)}
                      className="flex items-center gap-3.5 rounded-2xl border border-ink/5 bg-white p-3 text-left shadow-card transition-colors hover:border-primary-300 hover:bg-primary-50/40"
                    >
                      <PlaceImage
                        image={place.image}
                        category={place.category}
                        alt={place.name}
                        className="size-16 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{place.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{place.description}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {place.city}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {formatDuration(place.durationMin)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Wallet size={11} /> {priceText(place)}
                          </span>
                          <PlaceRating
                            rating={place.rating}
                            userRatingCount={place.userRatingCount}
                            isDemoData={place.demoDataFields?.includes('rating') ?? false}
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {selected && (
          <div className="flex items-center gap-3 border-t border-ink/5 bg-white p-4 sm:px-6">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-cream"
            >
              Choisir un autre lieu
            </button>
            <button
              type="button"
              disabled={isInvalid || isSubmitting}
              onClick={() => onConfirm(selected, { startTime, endTime })}
              className="ml-auto flex items-center gap-2 rounded-full bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {confirmLabel} · {startTime}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active ? 'bg-primary-500 text-white' : 'bg-cream text-ink-soft hover:bg-primary-50 hover:text-primary-600'
      }`}
    >
      {children}
    </button>
  )
}
