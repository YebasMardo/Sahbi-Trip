import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Coins,
  MapPin,
  Plane,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ActionStatusModal, { useActionStatus } from '../components/ActionStatusModal'
import BudgetDonut from '../components/BudgetDonut'
import PlaceImage from '../components/PlaceImage'
import { ErrorCard, LoadingCard, errorMessage } from '../components/QueryState'
import RouteMapCard from '../components/dashboard/RouteMapCard'
import StatusBadge from '../components/dashboard/StatusBadge'
import TripAssistant from '../components/dashboard/TripAssistant'
import VisitProgressCard, { VisitProgressBar } from '../components/dashboard/VisitProgress'
import DashboardLayout from '../layouts/DashboardLayout'
import {
  useAdaptBudgetMutation,
  useConfirmTripMutation,
  useGetTripViewQuery,
  useOptimizeTripMutation,
} from '../features/trips/trips.apiSlice'
import { budgetPercentages, dayBudget, dayProgress, daysCompleted, formatMAD, tripProgress } from '../data/trips'

export default function TripOverviewPage() {
  const { tripId = '' } = useParams()
  const { data, isLoading, error, refetch } = useGetTripViewQuery(tripId, { skip: !tripId })
  const [confirmTrip, { isLoading: isConfirming }] = useConfirmTripMutation()
  const [optimizeTrip, { isLoading: isOptimizing }] = useOptimizeTripMutation()
  const [adaptBudget, { isLoading: isAdapting }] = useAdaptBudgetMutation()

  const { status, run, close } = useActionStatus()
  const [showAdapt, setShowAdapt] = useState(false)
  const [remaining, setRemaining] = useState('')

  const trip = data?.data

  if (isLoading) {
    return (
      <DashboardLayout title="Chargement…" subtitle="Récupération de votre voyage">
        <LoadingCard label="Chargement du voyage…" />
      </DashboardLayout>
    )
  }

  if (error || !trip) {
    return (
      <DashboardLayout title="Voyage introuvable" subtitle="Ce voyage n'existe pas ou ne vous appartient pas">
        <ErrorCard
          title="Voyage introuvable"
          message={errorMessage(error) ?? 'Revenez à la liste de vos voyages.'}
          onRetry={() => void refetch()}
        />
        <Link to="/dashboard/trips" className="mt-4 inline-block text-sm font-medium text-primary-500">
          ← Mes voyages
        </Link>
      </DashboardLayout>
    )
  }

  const heroDay = trip.days[0]
  const categories = budgetPercentages(trip.budgetCategories)
  const progress = tripProgress(trip)
  const completedDays = daysCompleted(trip)
  const isBusy = isConfirming || isOptimizing || isAdapting

  const stats = [
    {
      icon: Calendar,
      value: trip.days.length,
      label: 'Jours',
      sub: trip.dateRangeLabel,
      tint: 'bg-teal-50 text-teal-500',
    },
    { icon: Users, value: trip.travelers, label: 'Voyageurs', sub: null, tint: 'bg-violet-50 text-violet-500' },
    {
      icon: Coins,
      value: formatMAD(trip.budgetPerPersonMAD),
      label: 'Budget estimé',
      sub: '(par personne)',
      tint: 'bg-primary-50 text-primary-500',
    },
    {
      icon: Sparkles,
      value: trip.activitiesRetained,
      label: 'Activités',
      sub: `(sur ${trip.activitiesConsidered} proposées)`,
      tint: 'bg-rose-50 text-rose-500',
    },
  ]

  async function handleValidate() {
    await run(() => confirmTrip(tripId).unwrap(), {
      loading: 'Remplissage du dashboard par l’IA…',
      orb: 'composing',
      success: 'Voyage validé — le dashboard a été rempli par l’IA.',
      error: 'La validation a échoué.',
    })
  }

  async function handleOptimize() {
    await run(() => optimizeTrip({ tripId }).unwrap(), {
      loading: "Réorganisation de l'itinéraire…",
      orb: 'solving',
      success: (result) => result.data.explanation || 'Itinéraire réorganisé.',
      error: "L'optimisation a échoué.",
    })
  }

  async function handleAdaptBudget() {
    const value = Number(remaining)
    if (!Number.isFinite(value) || value <= 0) return
    const result = await run(() => adaptBudget({ tripId, remaining: value }).unwrap(), {
      loading: 'Recalcul du budget par l’IA…',
      orb: 'composing',
      success: `Itinéraire régénéré pour ${formatMAD(value)}.`,
      error: "L'adaptation au budget a échoué.",
    })
    if (result.ok) {
      setShowAdapt(false)
      setRemaining('')
    }
  }

  return (
    <DashboardLayout title={trip.title} subtitle={trip.destinationLabel}>
      {status && <ActionStatusModal status={status} onClose={close} />}

      {trip.status === 'draft' && (
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-violet-400/20 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-violet-500">
              <Sparkles size={16} />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-violet-600">Proposition générée par l'IA</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Vérifiez les activités jour par jour, puis validez pour figer votre voyage et remplir le dashboard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleValidate}
            disabled={isBusy}
            className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-violet-600 disabled:opacity-60"
          >
            <CheckCircle2 size={15} />
            Valider mon voyage
          </button>
        </div>
      )}

      {trip.status === 'completed' && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-ink/5 px-4 py-3 text-xs font-medium text-ink-soft">
          <CheckCircle2 size={14} /> Ce voyage est terminé — vous consultez son récapitulatif.
        </div>
      )}

      {/* Hero trip card */}
      <section className="relative mt-4 overflow-hidden rounded-3xl shadow-card-lg">
        <div className={`relative h-64 transition-opacity sm:h-72 ${isBusy ? 'opacity-60' : ''}`}>
          <PlaceImage image={trip.coverImage ?? heroDay?.heroImage ?? null} alt={trip.title} className="size-full" iconSize={40} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />

          <div className="absolute right-5 top-5 flex items-center gap-2">
            <StatusBadge status={trip.status} />
            <button
              type="button"
              onClick={handleOptimize}
              disabled={isBusy || trip.activitiesRetained === 0}
              title="Réordonner les journées pour limiter les trajets"
              className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/55 disabled:opacity-50"
            >
              <Wand2 size={14} />
              Optimiser
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
              <MapPin size={12} /> {trip.destinationLabel}
            </span>
            <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">{trip.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> {trip.dateRangeLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} /> {trip.travelers} voyageurs
              </span>
              {trip.themes.length > 0 && (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs backdrop-blur-md">
                  {trip.themes.join(' · ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-5 shadow-card">
            <span className={`grid size-10 place-items-center rounded-xl ${s.tint}`}>
              <s.icon size={19} />
            </span>
            <p className="mt-3 font-display text-2xl font-extrabold text-ink">{s.value}</p>
            <p className="text-sm text-ink-soft">{s.label}</p>
            {s.sub && <p className="text-xs text-ink-faint">{s.sub}</p>}
          </div>
        ))}
      </section>

      {/* Trip-wide visit progress */}
      <section className="mt-5">
        <VisitProgressCard
          title="Progression du voyage"
          subtitle={`${completedDays}/${trip.days.length} journée${trip.days.length > 1 ? 's' : ''} bouclée${completedDays > 1 ? 's' : ''} · ${progress.percentResolved}% des activités traitées`}
          progress={progress}
        />
      </section>

      {/* Program + sidebar cards */}
      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <Calendar size={16} className="text-primary-500" /> Programme du voyage
            </h3>
            {heroDay && (
              <Link
                to={`/dashboard/trips/${trip.id}/day/${heroDay.id}`}
                className="flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
              >
                Voir tout <ChevronRight size={14} />
              </Link>
            )}
          </div>

          <div className="flex flex-col divide-y divide-ink/5">
            {trip.days.map((day) => {
              const dp = dayProgress(day)
              return (
                <Link
                  key={day.id}
                  to={`/dashboard/trips/${trip.id}/day/${day.id}`}
                  className="group flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <PlaceImage
                    image={day.heroImage}
                    category={day.activities[0]?.category}
                    alt={day.title}
                    className="size-14 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink group-hover:text-primary-600">
                      Jour {day.dayNumber} — {day.city}
                    </p>
                    <p className="truncate text-xs text-ink-soft">{day.title.split('—')[1]?.trim() ?? day.title}</p>
                    <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-faint">
                      <span>
                        {day.activities.length} activité{day.activities.length > 1 ? 's' : ''}
                      </span>
                      <span>·</span>
                      <span>{formatMAD(dayBudget(day))}</span>
                      <span>·</span>
                      <span className={dp.percentVisited === 100 ? 'font-semibold text-teal-500' : ''}>
                        {dp.visited}/{dp.total} visité{dp.visited > 1 ? 's' : ''}
                      </span>
                    </p>
                    <VisitProgressBar progress={dp} className="mt-1.5 h-1.5 max-w-xs" />
                  </div>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500"
                  />
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-ink">
              <MapPin size={15} className="text-primary-500" /> Votre itinéraire sur la carte
            </h3>
            <RouteMapCard cities={[...new Set(trip.days.map((d) => d.city))]} />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-bold text-ink">
              <Coins size={15} className="text-primary-500" /> Répartition du budget
            </h3>
            <div className="flex items-center gap-5">
              <BudgetDonut categories={categories} total={trip.budgetPerPersonMAD} />
              <div className="flex-1 space-y-2.5">
                {categories.map((c) => (
                  <div key={c.key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-ink-soft">
                      <span className="size-2 rounded-full" style={{ background: c.color }} />
                      {c.label}
                    </span>
                    <span className="font-semibold text-ink">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-ink-faint">{formatMAD(trip.budgetPerPersonMAD)} par personne</p>

            <div className="mt-3 flex items-center justify-between border-t border-ink/5 pt-3 text-xs">
              <span className="text-ink-soft">
                {formatMAD(trip.budgetEstimatedMAD)} estimé sur {formatMAD(trip.budgetTotalMAD)}
              </span>
              <span
                className={`font-semibold ${trip.budgetRemainingMAD < 0 ? 'text-rose-500' : 'text-teal-500'}`}
              >
                {trip.budgetRemainingMAD < 0
                  ? `${formatMAD(Math.abs(trip.budgetRemainingMAD))} dépassé`
                  : `${formatMAD(trip.budgetRemainingMAD)} restant`}
              </span>
            </div>

            {trip.budgetAlerts.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {trip.budgetAlerts.map((alert) => (
                  <p
                    key={alert}
                    className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700"
                  >
                    <Coins size={12} className="mt-0.5 shrink-0" /> {alert}
                  </p>
                ))}
              </div>
            )}

            {/* Draft-only: the backend refuses to re-generate a confirmed trip. */}
            {trip.status === 'draft' && (
              <div className="mt-4 border-t border-ink/5 pt-4">
                {showAdapt ? (
                  <div>
                    <label className="block text-xs font-semibold text-ink-soft">
                      Budget restant (MAD)
                      <input
                        type="number"
                        min={1}
                        value={remaining}
                        onChange={(e) => setRemaining(e.target.value)}
                        placeholder="Ex : 2500"
                        className="mt-1.5 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink focus:border-primary-400 focus:outline-none"
                      />
                    </label>
                    <p className="mt-1.5 text-[11px] text-ink-faint">
                      L'IA reconstruit l'itinéraire sous cette contrainte.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={handleAdaptBudget}
                        disabled={isAdapting || !remaining}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary-500 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                      >
                        Recalculer
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAdapt(false)}
                        className="rounded-full bg-cream px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-ink/5"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAdapt(true)}
                    className="w-full rounded-full border border-primary-200 bg-white px-4 py-2 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50"
                  >
                    Adapter à un budget restant
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-violet-400/15 bg-violet-50 p-5">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-violet-500">
              <Sparkles size={15} /> L'IA a personnalisé votre voyage
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">{trip.aiNote}</p>
          </div>

          <TripAssistant tripId={trip.id} />
        </div>
      </section>

      {/* Quote banner */}
      <section className="relative mt-5 overflow-hidden rounded-2xl">
        <PlaceImage
          image={trip.days[trip.days.length - 1]?.heroImage ?? null}
          category="nature"
          alt="Paysage marocain"
          className="h-36 w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20" />
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10">
          <p className="max-w-xl font-display text-base italic text-white sm:text-lg">
            « Le vrai voyage, ce n'est pas de découvrir de nouveaux paysages, mais d'avoir de nouveaux yeux. »
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
            <Plane size={12} /> Sahbi Trip
          </p>
        </div>
      </section>
    </DashboardLayout>
  )
}
