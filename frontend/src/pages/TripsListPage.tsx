import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CardGridSkeleton, ErrorCard, errorMessage } from '../components/QueryState'
import TripCard from '../components/dashboard/TripCard'
import DashboardLayout from '../layouts/DashboardLayout'
import { useListTripsQuery } from '../features/trips/trips.apiSlice'
import type { TripStatus } from '../features/trips/trips.types'

type FilterKey = 'all' | 'upcoming' | 'draft' | 'completed'

const FILTERS: Array<{ key: FilterKey; label: string; match: (s: TripStatus) => boolean }> = [
  { key: 'all', label: 'Tous', match: () => true },
  { key: 'upcoming', label: 'À venir', match: (s) => s === 'confirmed' },
  { key: 'draft', label: 'Brouillons', match: (s) => s === 'draft' },
  { key: 'completed', label: 'Terminés', match: (s) => s === 'completed' },
]

export default function TripsListPage() {
  const { data, isLoading, error, refetch } = useListTripsQuery()
  const [filter, setFilter] = useState<FilterKey>('all')

  const trips = data?.data ?? []
  const activeFilter = FILTERS.find((f) => f.key === filter)!

  const filtered = useMemo(() => {
    return [...trips]
      .filter((t) => activeFilter.match(t.status))
      .sort((a, b) =>
        activeFilter.key === 'completed'
          ? b.startDate.localeCompare(a.startDate)
          : a.startDate.localeCompare(b.startDate),
      )
  }, [trips, activeFilter])

  return (
    <DashboardLayout title="Mes voyages" subtitle="Retrouvez tous vos itinéraires, brouillons et souvenirs.">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count = trips.filter((t) => f.match(t.status)).length
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-primary-500 text-white shadow-card'
                    : 'bg-white text-ink-soft hover:bg-cream'
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    filter === f.key ? 'bg-white/20 text-white' : 'bg-cream text-ink-faint'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <Link
          to="/dashboard/trips/new"
          className="flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600"
        >
          <Plus size={15} /> Nouveau voyage
        </Link>
      </div>

      {isLoading ? (
        <CardGridSkeleton />
      ) : error ? (
        <ErrorCard
          title="Impossible de charger vos voyages"
          message={errorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center text-sm text-ink-soft">
          {trips.length === 0 ? (
            <>
              Aucun voyage pour le moment.{' '}
              <Link to="/dashboard/trips/new" className="font-semibold text-primary-500 hover:text-primary-600">
                Créez votre premier itinéraire
              </Link>
              .
            </>
          ) : (
            'Aucun voyage dans cette catégorie.'
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
