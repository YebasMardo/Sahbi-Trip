import { ArrowRight, Calendar, CheckCircle2, Coins, Luggage, MapPin, Sparkles, Plane } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CardGridSkeleton, ErrorCard, errorMessage } from '../components/QueryState'
import AiPipelinePanel from '../components/dashboard/AiPipelinePanel'
import CityActivityBarChart from '../components/dashboard/CityActivityBarChart'
import TripCard from '../components/dashboard/TripCard'
import BudgetDonut from '../components/BudgetDonut'
import DashboardLayout from '../layouts/DashboardLayout'
import { selectAuthUser } from '../features/auth/auth.slice'
import { useListTripsQuery } from '../features/trips/trips.apiSlice'
import { useAppSelector } from '../store'
import { activitiesByCity, aggregateBudgetCategories, citiesExplored, formatMAD } from '../data/trips'

export default function DashboardHomePage() {
  const user = useAppSelector(selectAuthUser)
  const { data, isLoading, error, refetch } = useListTripsQuery()

  const trips = data?.data ?? []
  const upcoming = trips.filter((t) => t.status !== 'completed')
  const completed = trips.filter((t) => t.status === 'completed')
  const sortedUpcoming = [...upcoming].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const sortedCompleted = [...completed].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const nextTrip = sortedUpcoming[0]

  const firstName = (user?.fullname ?? '').trim().split(/\s+/)[0] || 'voyageur'

  const activitiesPlanned = trips.reduce((s, t) => s + t.activitiesRetained, 0)
  const totalBudgetEstimated = trips.reduce((s, t) => s + t.budgetEstimatedMAD, 0)
  const cityCounts = activitiesByCity(trips)
  const budgetCategories = aggregateBudgetCategories(trips)
  const budgetCategoriesTotal = budgetCategories.reduce((s, c) => s + c.amount, 0)

  const stats = [
    { icon: Luggage, value: trips.length, label: 'Voyages au total', tint: 'bg-primary-50 text-primary-500' },
    { icon: Plane, value: upcoming.length, label: 'À venir / brouillons', tint: 'bg-violet-50 text-violet-500' },
    { icon: CheckCircle2, value: completed.length, label: 'Voyages terminés', tint: 'bg-teal-50 text-teal-500' },
    { icon: MapPin, value: citiesExplored(trips), label: 'Villes explorées', tint: 'bg-azure-50 text-azure-500' },
    { icon: Calendar, value: activitiesPlanned, label: 'Activités planifiées', tint: 'bg-rose-50 text-rose-500' },
    {
      icon: Coins,
      value: formatMAD(totalBudgetEstimated),
      label: 'Budget estimé cumulé',
      tint: 'bg-teal-50 text-teal-500',
    },
  ]

  return (
    <DashboardLayout title={`Bonjour ${firstName}`} subtitle="Voici un aperçu de vos voyages au Maroc.">
      {/* CTA hero */}
      <section className="relative mt-2 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c2430] to-[#2e2018] px-6 py-10 text-white shadow-card-lg sm:px-10">
        <img
          src="https://commons.wikimedia.org/wiki/Special:FilePath/Koutbia.jpg?width=1600"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1c2430]/90 via-[#1c2430]/80 to-[#2e2018]/85" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/85">
            <Sparkles size={13} /> Itinéraires générés par IA
          </span>
          <h2 className="mt-4 max-w-xl font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            Prêt·e pour votre prochaine aventure au Maroc ?
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/65">
            Dites vos dates, votre budget et vos envies : l'IA construit un itinéraire jour par jour,
            avec des prix réels et sourcés.
          </p>
          <Link
            to="/dashboard/trips/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-card-lg transition-colors hover:bg-primary-600"
          >
            Créer un nouveau voyage <ArrowRight size={16} />
          </Link>
        </div>

        <span className="absolute bottom-2 right-3 text-[10px] font-medium text-white/40">
          © joaomaximo · CC BY 2.0
        </span>
      </section>

      {/* Stat cards */}
      <section className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-5 shadow-card">
            <span className={`grid size-10 place-items-center rounded-xl ${s.tint}`}>
              <s.icon size={19} />
            </span>
            <p className="mt-3 truncate font-display text-xl font-extrabold text-ink sm:text-2xl">
              {isLoading ? '—' : s.value}
            </p>
            <p className="text-sm text-ink-soft">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Analytics */}
      {!isLoading && trips.length > 0 && (
        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <Coins size={15} className="text-primary-500" /> Répartition du budget
            </h3>
            <p className="mt-0.5 text-xs text-ink-soft">Moyenne par personne, cumulée sur tous vos voyages.</p>
            {budgetCategoriesTotal > 0 ? (
              <div className="mt-4 flex items-center gap-5">
                <BudgetDonut categories={budgetCategories} total={budgetCategoriesTotal} />
                <div className="flex-1 space-y-2.5">
                  {budgetCategories.map((c) => (
                    <div key={c.key} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-ink-soft">
                        <span className="size-2 rounded-full" style={{ background: c.color }} />
                        {c.label}
                      </span>
                      <span className="font-semibold text-ink">{formatMAD(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-cream px-3.5 py-6 text-center text-xs text-ink-soft">
                Générez un voyage pour voir apparaître votre budget ici.
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <MapPin size={15} className="text-primary-500" /> Activités par destination
            </h3>
            <p className="mt-0.5 text-xs text-ink-soft">Toutes vos activités planifiées, ville par ville.</p>
            <div className="mt-4">
              <CityActivityBarChart data={cityCounts} />
            </div>
          </div>
        </section>
      )}

      {nextTrip && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink">Votre prochain voyage</h3>
            <Link
              to={`/dashboard/trips/${nextTrip.id}`}
              className="flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
            >
              Voir le détail <ArrowRight size={14} />
            </Link>
          </div>
          <div className="max-w-sm">
            <TripCard trip={nextTrip} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">Tous vos voyages</h3>
          <Link
            to="/dashboard/trips"
            className="flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
          >
            Voir tout <ArrowRight size={14} />
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
        ) : trips.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[...sortedUpcoming, ...sortedCompleted].map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <AiPipelinePanel />
      </section>
    </DashboardLayout>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary-50 text-primary-500">
        <Luggage size={20} />
      </span>
      <p className="mt-4 font-display text-base font-bold text-ink">Aucun voyage pour le moment</p>
      <p className="mt-1 text-sm text-ink-soft">Créez votre premier itinéraire personnalisé par l'IA.</p>
      <Link
        to="/dashboard/trips/new"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
      >
        Créer un voyage <ArrowRight size={15} />
      </Link>
    </div>
  )
}
