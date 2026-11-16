import { ArrowLeft, ChevronRight, Info, Plus, Sparkles, Wallet, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import ActionStatusModal, { useActionStatus } from '../components/ActionStatusModal'
import { ErrorCard, LoadingCard, errorMessage } from '../components/QueryState'
import ActivityPicker from '../components/dashboard/ActivityPicker'
import ActivityTimelineItem from '../components/dashboard/ActivityTimelineItem'
import AiAlternativesDialog from '../components/dashboard/AiAlternativesDialog'
import DayHeroCarousel from '../components/dashboard/DayHeroCarousel'
import ScheduleDialog from '../components/dashboard/ScheduleDialog'
import VisitProgressCard, { VisitProgressBar } from '../components/dashboard/VisitProgress'
import DashboardLayout from '../layouts/DashboardLayout'
import {
  useAddTripActivityMutation,
  useDeleteTripActivityMutation,
  useGetTripViewQuery,
  useOptimizeTripMutation,
  useReplaceActivityMutation,
  useUpdateTripActivityMutation,
} from '../features/trips/trips.apiSlice'
import type { PickerPlace, ReplaceAlternative } from '../features/trips/trips.types'
import {
  dayActivityNames,
  dayBudget,
  dayProgress,
  formatMAD,
  sortByStartTime,
  tripProgress,
  type ActivityItemStatus,
} from '../data/trips'

export default function TripDayPage() {
  const { tripId = '', dayId = '' } = useParams()
  const { data, isLoading, error, refetch } = useGetTripViewQuery(tripId, { skip: !tripId })

  const [addActivity, { isLoading: isAdding }] = useAddTripActivityMutation()
  const [updateActivity, { isLoading: isUpdating }] = useUpdateTripActivityMutation()
  const [deleteActivity] = useDeleteTripActivityMutation()
  const [requestAlternatives, alternativesState] = useReplaceActivityMutation()
  const [optimizeTrip, { isLoading: isOptimizing }] = useOptimizeTripMutation()

  const [picker, setPicker] = useState<{ mode: 'add' | 'replace'; activityId?: string } | null>(null)
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null)
  const [aiReplaceFor, setAiReplaceFor] = useState<string | null>(null)
  const [alternatives, setAlternatives] = useState<ReplaceAlternative[]>([])
  const { status: actionStatus, run, close } = useActionStatus()

  const trip = data?.data

  if (isLoading) {
    return (
      <DashboardLayout title="Chargement…" subtitle="Récupération de la journée">
        <LoadingCard label="Chargement de la journée…" />
      </DashboardLayout>
    )
  }

  if (error || !trip) {
    return (
      <DashboardLayout title="Voyage introuvable" subtitle="Ce voyage n'existe pas ou ne vous appartient pas">
        <ErrorCard message={errorMessage(error)} onRetry={() => void refetch()} />
        <Link to="/dashboard/trips" className="mt-4 inline-block text-sm font-medium text-primary-500">
          ← Mes voyages
        </Link>
      </DashboardLayout>
    )
  }

  const day = trip.days.find((d) => d.id === dayId)
  if (!day) return <Navigate to={`/dashboard/trips/${trip.id}`} replace />

  // A draft trip's items are a preview of the AI proposal — they have no
  // TripActivity rows behind them yet, so nothing is editable until the
  // traveler validates the trip (which is what materialises those rows).
  const isEditable = trip.status !== 'draft'

  const activities = sortByStartTime(day.activities)
  const progress = dayProgress(day)
  const wholeTripProgress = tripProgress(trip)
  const replacedActivity = picker?.activityId ? day.activities.find((a) => a.id === picker.activityId) : undefined
  const editingActivity = editingTimeId ? day.activities.find((a) => a.id === editingTimeId) : undefined

  async function handlePickerConfirm(place: PickerPlace, schedule: { startTime: string; endTime: string }) {
    if (!picker) return
    const isReplace = picker.mode === 'replace' && picker.activityId

    const result = await run(
      () =>
        isReplace
          ? updateActivity({
              tripId,
              taId: picker.activityId!,
              type: place.type,
              refId: place.refId,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            }).unwrap()
          : addActivity({
              tripId,
              type: place.type,
              refId: place.refId,
              day: day!.dayNumber,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            }).unwrap(),
      {
        loading: isReplace ? 'Remplacement en cours…' : 'Ajout au programme…',
        orb: 'connecting',
        success: isReplace
          ? `« ${place.name} » remplace l'activité précédente.`
          : `« ${place.name} » ajouté au programme.`,
        error: isReplace ? 'Le remplacement a échoué.' : "L'ajout a échoué.",
      },
    )
    if (result.ok) setPicker(null)
  }

  async function handleAskAi(taId: string) {
    setAiReplaceFor(taId)
    setAlternatives([])
    try {
      const result = await requestAlternatives({ tripId, taId }).unwrap()
      setAlternatives(result.data.alternatives)
    } catch {
      // Surfaced by the dialog through `alternativesState.error`.
    }
  }

  async function handleApplyAlternative(activityId: string) {
    if (!aiReplaceFor) return
    const result = await run(
      () => updateActivity({ tripId, taId: aiReplaceFor, type: 'activity', refId: activityId }).unwrap(),
      {
        loading: 'Application de la suggestion de l’IA…',
        orb: 'connecting',
        success: 'Activité remplacée par la suggestion de l’IA.',
        error: 'Le remplacement a échoué.',
      },
    )
    if (result.ok) setAiReplaceFor(null)
  }

  const totalBudget = dayBudget(day)
  const costOf = (kind: 'activity' | 'restaurant' | 'transport') =>
    day.activities.filter((a) => a.kind === kind).reduce((s, a) => s + (a.price ?? 0), 0)

  const dayIndex = trip.days.findIndex((d) => d.id === day.id)
  const prevDay = trip.days[dayIndex - 1]
  const nextDay = trip.days[dayIndex + 1]

  return (
    <DashboardLayout
      title={`Jour ${day.dayNumber} — ${day.city}`}
      subtitle={new Date(day.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
    >
      <div className="mt-2">
        <Link
          to={`/dashboard/trips/${trip.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-primary-600"
        >
          <ArrowLeft size={15} /> {trip.title}
        </Link>

        {actionStatus && <ActionStatusModal status={actionStatus} onClose={close} />}

        {!isEditable && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-violet-400/20 bg-violet-50 px-4 py-3">
            <Info size={15} className="mt-0.5 shrink-0 text-violet-500" />
            <p className="text-xs text-ink-soft">
              Ceci est la proposition de l'IA.{' '}
              <Link to={`/dashboard/trips/${trip.id}`} className="font-semibold text-violet-600 hover:underline">
                Validez le voyage
              </Link>{' '}
              pour pouvoir ajouter, déplacer ou remplacer des activités.
            </p>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {day.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
              {tag}
            </span>
          ))}
        </div>

        <DayHeroCarousel day={day} />

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                <span className="grid size-6 place-items-center rounded-md bg-primary-50 text-primary-500">
                  <Wallet size={13} />
                </span>
                Programme de la journée
              </h3>
              <div className="flex items-center gap-2">
                {isEditable && activities.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      void run(() => optimizeTrip({ tripId, day: day.dayNumber }).unwrap(), {
                        loading: 'Réorganisation de la journée…',
                        orb: 'solving',
                        success: 'Journée réorganisée pour limiter les trajets.',
                        error: "L'optimisation a échoué.",
                      })
                    }
                    disabled={isOptimizing}
                    className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3.5 py-2 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50 disabled:opacity-50"
                  >
                    <Wand2 size={13} />
                    Optimiser
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPicker({ mode: 'add' })}
                  disabled={!isEditable}
                  title={isEditable ? undefined : 'Validez le voyage pour modifier le programme'}
                  className="flex items-center gap-1.5 rounded-full bg-primary-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-40"
                >
                  <Plus size={14} /> Ajouter une activité
                </button>
              </div>
            </div>

            <VisitProgressCard
              title="Progression de la journée"
              subtitle={`Jour ${day.dayNumber} — ${day.city}`}
              progress={progress}
              className="mb-4"
            />

            <div className="flex flex-col">
              {activities.length === 0 && (
                <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-8 text-center">
                  <p className="font-display text-sm font-bold text-ink">Journée libre</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {isEditable
                      ? "Ajoutez une première activité et choisissez l'heure qui vous convient."
                      : "L'IA n'a rien planifié ce jour-là."}
                  </p>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => setPicker({ mode: 'add' })}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-600"
                    >
                      <Plus size={14} /> Ajouter une activité
                    </button>
                  )}
                </div>
              )}
              {activities.map((item, i) => (
                <ActivityTimelineItem
                  key={item.id}
                  item={item}
                  isLast={i === activities.length - 1}
                  detailHref={`/dashboard/trips/${trip.id}/day/${day.id}/activity/${item.id}`}
                  onReplace={isEditable ? () => setPicker({ mode: 'replace', activityId: item.id }) : undefined}
                  onSuggestAlternatives={isEditable ? () => void handleAskAi(item.id) : undefined}
                  onEditTime={isEditable ? () => setEditingTimeId(item.id) : undefined}
                  onDelete={
                    isEditable
                      ? () =>
                          void run(() => deleteActivity({ tripId, taId: item.id }).unwrap(), {
                            loading: 'Suppression…',
                            orb: 'working',
                            success: 'Élément supprimé.',
                            error: 'La suppression a échoué.',
                          })
                      : undefined
                  }
                  onChangeStatus={
                    isEditable
                      ? (newStatus: ActivityItemStatus) =>
                          void run(() => updateActivity({ tripId, taId: item.id, status: newStatus }).unwrap(), {
                            loading: 'Mise à jour du statut…',
                            orb: 'working',
                            success: 'Statut mis à jour.',
                            error: 'La mise à jour a échoué.',
                          })
                      : undefined
                  }
                />
              ))}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h4 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
                  <Wallet size={15} className="text-primary-500" /> Budget de la journée
                </h4>
                <p className="mt-1 font-display text-2xl font-extrabold text-ink">
                  {formatMAD(totalBudget)} <span className="text-xs font-medium text-ink-faint">(par personne)</span>
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  {costOf('activity') > 0 && (
                    <BudgetRow label="Activités" amount={costOf('activity')} color="bg-teal-400" />
                  )}
                  {costOf('restaurant') > 0 && (
                    <BudgetRow label="Restauration" amount={costOf('restaurant')} color="bg-violet-400" />
                  )}
                  {costOf('transport') > 0 && (
                    <BudgetRow label="Transport" amount={costOf('transport')} color="bg-azure-400" />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-primary-400/15 bg-primary-50 p-5">
                <h4 className="flex items-center gap-2 font-display text-sm font-bold text-primary-600">
                  <Sparkles size={15} /> Votre journée, vos règles
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  Cliquez sur l'heure d'une activité pour la déplacer, ou ouvrez son menu (⋮) pour la remplacer,
                  demander une suggestion à l'IA, ou dire où vous en êtes de la visite.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              {prevDay ? (
                <Link
                  to={`/dashboard/trips/${trip.id}/day/${prevDay.id}`}
                  className="flex items-center gap-1 font-medium text-ink-soft hover:text-primary-600"
                >
                  <ArrowLeft size={14} /> Jour {prevDay.dayNumber}
                </Link>
              ) : (
                <span />
              )}
              {nextDay && (
                <Link
                  to={`/dashboard/trips/${trip.id}/day/${nextDay.id}`}
                  className="flex items-center gap-1 font-medium text-primary-500 hover:text-primary-600"
                >
                  Jour {nextDay.dayNumber} <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-5">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h4 className="mb-3 font-display text-sm font-bold text-ink">Résumé du jour</h4>
              <dl className="space-y-2.5 text-xs">
                <Row label="Ville" value={day.city} />
                <Row label="Activités" value={String(day.activities.length)} />
                <Row label="Visites faites" value={`${progress.visited}/${progress.total}`} />
                <Row label="Météo" value={`${day.weatherC}°C, ${day.weatherLabel}`} />
                <Row label="Budget" value={formatMAD(totalBudget)} />
              </dl>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-card">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h4 className="font-display text-sm font-bold text-ink">Progression du voyage</h4>
                <span className="text-xs font-semibold text-teal-500">{wholeTripProgress.percentVisited}%</span>
              </div>
              <VisitProgressBar progress={wholeTripProgress} />
              <p className="mt-2 text-[11px] text-ink-faint">
                {wholeTripProgress.visited} visite{wholeTripProgress.visited > 1 ? 's' : ''} sur{' '}
                {wholeTripProgress.total} activités planifiées.
              </p>

              <div className="mt-4 flex flex-col divide-y divide-ink/5">
                {trip.days.map((d) => {
                  const p = dayProgress(d)
                  return (
                    <Link
                      key={d.id}
                      to={`/dashboard/trips/${trip.id}/day/${d.id}`}
                      className="py-2.5 first:pt-0 last:pb-0"
                    >
                      <div
                        className={`flex items-center justify-between text-xs ${
                          d.id === day.id ? 'font-semibold text-primary-600' : 'text-ink-soft hover:text-ink'
                        }`}
                      >
                        <span>
                          Jour {d.dayNumber} — {d.city}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-ink-faint">
                          {p.visited}/{p.total} <ChevronRight size={13} />
                        </span>
                      </div>
                      <VisitProgressBar progress={p} className="mt-1.5 h-1.5" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {picker && (
        <ActivityPicker
          title={picker.mode === 'add' ? 'Ajouter une activité' : 'Remplacer cette activité'}
          city={day.city}
          dayActivities={day.activities}
          // Never propose something already booked that day. In replace mode the
          // activity being swapped out is not a duplicate of itself.
          excludeNames={dayActivityNames(day).filter((n) => n !== replacedActivity?.name)}
          initialSchedule={
            replacedActivity
              ? { startTime: replacedActivity.startTime, endTime: replacedActivity.endTime }
              : undefined
          }
          ignoreActivityId={picker.activityId}
          confirmLabel={picker.mode === 'add' ? 'Ajouter au programme' : 'Remplacer'}
          isSubmitting={isAdding || isUpdating}
          onConfirm={(place, schedule) => void handlePickerConfirm(place, schedule)}
          onClose={() => setPicker(null)}
        />
      )}

      {aiReplaceFor && (
        <AiAlternativesDialog
          alternatives={alternatives}
          isLoading={alternativesState.isLoading}
          error={alternativesState.error}
          isApplying={isUpdating}
          onApply={(activityId) => void handleApplyAlternative(activityId)}
          onClose={() => setAiReplaceFor(null)}
        />
      )}

      {editingActivity && (
        <ScheduleDialog
          activity={editingActivity}
          dayActivities={day.activities}
          onSave={(startTime, endTime) => {
            void run(() => updateActivity({ tripId, taId: editingActivity.id, startTime, endTime }).unwrap(), {
              loading: 'Mise à jour des horaires…',
              orb: 'working',
              success: 'Horaires mis à jour.',
              error: 'La mise à jour des horaires a échoué.',
            })
            setEditingTimeId(null)
          }}
          onClose={() => setEditingTimeId(null)}
        />
      )}
    </DashboardLayout>
  )
}

function BudgetRow({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-ink-soft">
        <span className={`size-2 rounded-full ${color}`} /> {label}
      </span>
      <span className="font-semibold text-ink">{formatMAD(amount)}</span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  )
}
