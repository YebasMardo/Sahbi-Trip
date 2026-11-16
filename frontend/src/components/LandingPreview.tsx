import { ArrowRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import BudgetDonut from './BudgetDonut'
import { budgetPercentages, formatMAD } from '../data/trips'
import { useListActivitiesQuery, useListRestaurantsQuery } from '../features/trips/trips.apiSlice'
import type { BudgetCategory } from '../features/trips/trips.types'

/**
 * Marketing preview of a day, built from the live catalogue rather than a
 * fixture — the surrounding copy claims "un exemple réel, construit à partir de
 * notre catalogue", so it has to actually be one. Places and prices come from
 * `GET /activities` and `GET /restaurants` (public routes, no session needed).
 *
 * The budget ring is an illustration of the split, labelled as such: a real
 * trip's totals are computed server-side by BudgetService once the traveler's
 * own dates, party size and budget are known.
 */
const PREVIEW_CITY = 'Marrakech'

export default function LandingPreview() {
  const activities = useListActivitiesQuery({ city: PREVIEW_CITY, limit: 3 })
  const restaurants = useListRestaurantsQuery({ city: PREVIEW_CITY, limit: 1 })

  const isLoading = activities.isLoading || restaurants.isLoading
  const places = activities.data?.data.items ?? []
  const restaurant = restaurants.data?.data.items[0]

  // Illustrative per-person split over the places shown, using only sourced
  // figures — an unpriced place contributes nothing rather than a guess.
  const activitiesTotal = places.reduce((sum, a) => sum + (a.price ?? 0), 0)
  const foodEstimate = restaurant ? 150 : 0
  const categories: BudgetCategory[] = [
    { key: 'hebergement', label: 'Hébergement', amount: 175, color: 'var(--color-primary-400)' },
    { key: 'restauration', label: 'Restauration', amount: foodEstimate, color: 'var(--color-violet-400)' },
    { key: 'activites', label: 'Activités', amount: activitiesTotal, color: 'var(--color-teal-400)' },
    { key: 'transport', label: 'Transport', amount: 40, color: 'var(--color-azure-400)' },
  ]
  const total = categories.reduce((s, c) => s + c.amount, 0)
  const previewCategories = budgetPercentages(categories)

  // Illustrative start times — the real planner assigns slots from opening
  // hours and travel distance, which a static preview cannot know.
  const slots = ['09:00', '11:30', '15:00']

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
      <div>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary-500">Aperçu</span>
        <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
          Voici à quoi ressemble votre voyage
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">
          Des lieux réels de notre catalogue {PREVIEW_CITY}, avec leurs prix sourcés — exactement ce que l'IA
          organise en itinéraire jour par jour.
        </p>
        <Link
          to="/signup"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600"
        >
          Créer mon itinéraire <ArrowRight size={15} />
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-ink/5 bg-white shadow-card-lg">
        <div className="flex items-center gap-2 border-b border-ink/5 bg-cream-50 px-5 py-3.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-ink/10" />
            <span className="size-2.5 rounded-full bg-ink/10" />
            <span className="size-2.5 rounded-full bg-ink/10" />
          </span>
          <span className="ml-2 text-xs font-medium text-ink-faint">Journée à {PREVIEW_CITY}</span>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-7">
          <div className="flex flex-col items-center gap-2">
            <BudgetDonut categories={previewCategories} total={total} size={128} />
            <p className="text-center text-[11px] text-ink-faint">
              Répartition indicative
              <br />
              par personne
            </p>
          </div>

          <div>
            {isLoading ? (
              <p className="flex items-center gap-2 text-xs text-ink-faint">
                <Loader2 size={12} className="animate-spin" /> Chargement du catalogue…
              </p>
            ) : places.length === 0 ? (
              <p className="text-xs text-ink-faint">Catalogue momentanément indisponible.</p>
            ) : (
              <>
                <p className="text-xs font-semibold text-ink-soft">Exemple de programme</p>
                <div className="mt-3 flex flex-col gap-3">
                  {places.map((place, i) => (
                    <div key={place.id} className="flex items-center gap-3 text-sm">
                      <span className="w-12 shrink-0 font-mono text-[11px] text-ink-faint">
                        {slots[i] ?? '—'}
                      </span>
                      <span className="flex-1 truncate font-medium text-ink">{place.name}</span>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {place.isFree
                          ? 'Gratuit'
                          : place.price != null
                            ? formatMAD(place.price)
                            : 'Non renseigné'}
                      </span>
                    </div>
                  ))}
                  {restaurant && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="w-12 shrink-0 font-mono text-[11px] text-ink-faint">13:00</span>
                      <span className="flex-1 truncate font-medium text-ink">{restaurant.name}</span>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {restaurant.priceLevel ? `Niveau ${restaurant.priceLevel}` : 'Non renseigné'}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
