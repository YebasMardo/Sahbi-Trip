import {
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Info,
  MapPin,
  PencilLine,
  Phone,
  Repeat,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import ActionStatusModal, { useActionStatus } from '../components/ActionStatusModal'
import PlaceImage from '../components/PlaceImage'
import { ErrorCard, LoadingCard, errorMessage } from '../components/QueryState'
import ActivityPicker from '../components/dashboard/ActivityPicker'
import ScheduleDialog from '../components/dashboard/ScheduleDialog'
import DashboardLayout from '../layouts/DashboardLayout'
import {
  useDeleteTripActivityMutation,
  useGetActivityQuery,
  useGetTripViewQuery,
  useUpdateTripActivityMutation,
} from '../features/trips/trips.apiSlice'
import type { PickerPlace } from '../features/trips/trips.types'
import {
  ACTIVITY_STATUS_HINTS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_ORDER,
  activityStatus,
  dayActivityNames,
  formatDuration,
  formatMAD,
} from '../data/trips'

export default function ActivityDetailPage() {
  const { tripId = '', dayId = '', activityId = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useGetTripViewQuery(tripId, { skip: !tripId })
  const [updateActivity, { isLoading: isUpdating }] = useUpdateTripActivityMutation()
  const [deleteActivity, { isLoading: isDeleting }] = useDeleteTripActivityMutation()

  const [showReplace, setShowReplace] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { status: actionStatus, run, close } = useActionStatus()

  const trip = data?.data

  if (isLoading) {
    return (
      <DashboardLayout title="Chargement…" subtitle="Récupération de l'activité">
        <LoadingCard label="Chargement de l'activité…" />
      </DashboardLayout>
    )
  }

  if (error || !trip) {
    return (
      <DashboardLayout title="Introuvable" subtitle="Ce voyage n'existe pas ou ne vous appartient pas">
        <ErrorCard message={errorMessage(error)} onRetry={() => void refetch()} />
        <Link to="/dashboard/trips" className="mt-4 inline-block text-sm font-medium text-primary-500">
          ← Mes voyages
        </Link>
      </DashboardLayout>
    )
  }

  const day = trip.days.find((d) => d.id === dayId)
  if (!day) return <Navigate to={`/dashboard/trips/${trip.id}`} replace />

  const activity = day.activities.find((a) => a.id === activityId)
  if (!activity) return <Navigate to={`/dashboard/trips/${trip.id}/day/${day.id}`} replace />

  const isEditable = trip.status !== 'draft'
  const status = activityStatus(activity)
  const dayHref = `/dashboard/trips/${trip.id}/day/${day.id}`

  return (
    <DashboardLayout title={activity.name} subtitle={`Jour ${day.dayNumber} — ${day.city}`}>
      <button
        type="button"
        onClick={() => navigate(dayHref)}
        className="mb-3 mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-primary-600"
      >
        <ArrowLeft size={15} /> Retour au jour {day.dayNumber}
      </button>

      {actionStatus && <ActionStatusModal status={actionStatus} onClose={close} />}

      {!isEditable && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-violet-400/20 bg-violet-50 px-4 py-3">
          <Info size={15} className="mt-0.5 shrink-0 text-violet-500" />
          <p className="text-xs text-ink-soft">
            Proposition de l'IA —{' '}
            <Link to={`/dashboard/trips/${trip.id}`} className="font-semibold text-violet-600 hover:underline">
              validez le voyage
            </Link>{' '}
            pour la modifier.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-3xl bg-white shadow-card-lg">
          <PlaceImage
            image={activity.image}
            category={activity.category}
            alt={activity.name}
            className="h-64 w-full sm:h-80"
            showCredit
          />

          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                {activity.categoryLabel}
              </span>
              <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink-soft">
                {ACTIVITY_STATUS_LABELS[status]}
              </span>
              {activity.priceConfidence === 'low' && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
                  Prix à confirmer
                </span>
              )}
              {activity.priceConfidence === 'estimated' && (
                <span className="rounded-full bg-azure-50 px-3 py-1 text-xs font-semibold text-azure-500">
                  Prix estimé
                </span>
              )}
            </div>
            <h2 className="mt-3 font-display text-2xl font-extrabold text-ink">{activity.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{activity.description}</p>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoTile
                icon={Clock}
                label="Horaire"
                value={`${activity.startTime} – ${activity.endTime}`}
                onEdit={isEditable ? () => setShowSchedule(true) : undefined}
              />
              <InfoTile icon={Clock} label="Durée" value={formatDuration(activity.durationMin)} />
              <InfoTile
                icon={Wallet}
                label="Prix"
                value={
                  activity.isFree
                    ? 'Gratuit'
                    : activity.price != null
                      ? formatMAD(activity.price)
                      : 'Non renseigné'
                }
              />
            </div>

            {activity.kind === 'activity' && <CatalogueFacts refId={activity.refId} />}
          </div>
        </div>

        <aside className="flex flex-col gap-5">
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h4 className="font-display text-sm font-bold text-ink">Où en êtes-vous de la visite ?</h4>
            <p className="mt-0.5 text-xs text-ink-soft">Confirmez que vous irez, ou dites si vous y êtes allé·e.</p>
            <div className="mt-3 flex flex-col gap-2">
              {ACTIVITY_STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!isEditable || isUpdating}
                  onClick={() =>
                    void run(() => updateActivity({ tripId, taId: activityId, status: s }).unwrap(), {
                      loading: 'Mise à jour du statut…',
                      orb: 'working',
                      success: 'Statut mis à jour.',
                      error: 'La mise à jour du statut a échoué.',
                    })
                  }
                  className={`flex items-start justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors disabled:opacity-60 ${
                    s === status ? 'bg-primary-50 text-primary-600' : 'bg-cream text-ink-soft hover:bg-ink/5'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{ACTIVITY_STATUS_LABELS[s]}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-faint">{ACTIVITY_STATUS_HINTS[s]}</span>
                  </span>
                  {s === status && <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {isEditable && (
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h4 className="mb-3 font-display text-sm font-bold text-ink">Actions</h4>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowSchedule(true)}
                  className="flex items-center justify-center gap-2 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
                >
                  <PencilLine size={14} /> Modifier les horaires
                </button>
                {activity.kind !== 'transport' && (
                  <button
                    type="button"
                    onClick={() => setShowReplace(true)}
                    className="flex items-center justify-center gap-2 rounded-full border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-600 transition-colors hover:bg-primary-50"
                  >
                    <Repeat size={14} /> Remplacer par un autre lieu
                  </button>
                )}
                {confirmDelete ? (
                  <div className="rounded-xl bg-rose-50 p-3">
                    <p className="text-xs font-medium text-rose-600">
                      Supprimer définitivement cette activité du jour ?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() =>
                          void run(
                            async () => {
                              await deleteActivity({ tripId, taId: activityId }).unwrap()
                              navigate(dayHref)
                            },
                            {
                              loading: 'Suppression…',
                              orb: 'working',
                              success: 'Élément supprimé.',
                              error: 'La suppression a échoué.',
                            },
                          )
                        }
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-500 transition-colors hover:bg-rose-50"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {showReplace && activity.kind !== 'transport' && (
        <ActivityPicker
          title="Remplacer cette activité"
          city={day.city}
          dayActivities={day.activities}
          excludeNames={dayActivityNames(day).filter((n) => n !== activity.name)}
          initialSchedule={{ startTime: activity.startTime, endTime: activity.endTime }}
          ignoreActivityId={activity.id}
          confirmLabel="Remplacer"
          isSubmitting={isUpdating}
          onConfirm={(place: PickerPlace, schedule) =>
            void run(
              async () => {
                await updateActivity({
                  tripId,
                  taId: activityId,
                  type: place.type,
                  refId: place.refId,
                  startTime: schedule.startTime,
                  endTime: schedule.endTime,
                }).unwrap()
                setShowReplace(false)
                navigate(dayHref)
              },
              {
                loading: 'Remplacement en cours…',
                orb: 'connecting',
                success: `« ${place.name} » remplace l'activité précédente.`,
                error: 'Le remplacement a échoué.',
              },
            )
          }
          onClose={() => setShowReplace(false)}
        />
      )}

      {showSchedule && (
        <ScheduleDialog
          activity={activity}
          dayActivities={day.activities}
          onSave={(startTime, endTime) => {
            void run(() => updateActivity({ tripId, taId: activityId, startTime, endTime }).unwrap(), {
              loading: 'Mise à jour des horaires…',
              orb: 'working',
              success: 'Horaires mis à jour.',
              error: 'La mise à jour des horaires a échoué.',
            })
            setShowSchedule(false)
          }}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </DashboardLayout>
  )
}

/**
 * The trip view carries only what the timeline needs. The full catalogue record
 * — address, phone, opening hours, sourcing — is fetched here so the detail page
 * can show the transparency fields the dataset insists on (`sources`,
 * `lastChecked`, `priceNote`) rather than presenting figures unsourced.
 *
 * Renders nothing until the lookup succeeds, so a transport leg or a stale slug
 * shows no card rather than a broken one.
 */
function CatalogueFacts({ refId }: { refId: string }) {
  const { data } = useGetActivityQuery(refId, { skip: !refId })
  const place = data?.data
  if (!place) return null

  return (
    <div className="mt-5 border-t border-ink/5 pt-5">
      <h4 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-ink">
        <MapPin size={15} className="text-primary-500" /> Informations pratiques
      </h4>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {place.rating != null && (
          <RatingFact rating={place.rating} userRatingCount={place.userRatingCount} />
        )}
        {place.address && <Fact icon={MapPin} label="Adresse" value={place.address} />}
        {place.openingHours && <Fact icon={Clock} label="Horaires" value={place.openingHours} />}
        {place.requiresBooking && <Fact icon={Ticket} label="Réservation" value="Obligatoire" />}
        {place.priceNote && <Fact icon={Wallet} label="Note tarifaire" value={place.priceNote} />}
        <Fact icon={CalendarCheck2} label="Vérifié le" value={place.lastChecked} />
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {place.website && (
          place.demoDataFields?.includes('website') ? (
            <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-[11px] font-semibold text-ink-faint">
              <Globe size={11} /> Site non vérifié
            </span>
          ) : (
            <a
              href={place.website}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600"
            >
              <Globe size={11} /> Site officiel
            </a>
          )
        )}
        {place.phone && (
          place.demoDataFields?.includes('phone') ? (
            <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-[11px] font-semibold text-ink-faint">
              <Phone size={11} /> {place.phone}
            </span>
          ) : (
            <a
              href={`tel:${place.phone}`}
              className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600"
            >
              <Phone size={11} /> {place.phone}
            </a>
          )
        )}
        {place.coordinates && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${place.coordinates.lat},${place.coordinates.lng}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600"
          >
            <MapPin size={11} /> Voir sur Maps
          </a>
        )}
      </div>

      {place.sources.length > 0 && (
        <div className="mt-3 border-t border-ink/5 pt-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            <Sparkles size={10} /> Sources
          </p>
          <ul className="mt-1.5 space-y-1">
            {place.sources.slice(0, 3).map((src) => (
              <li key={src}>
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1 truncate text-[11px] text-primary-500 hover:underline"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  <span className="truncate">{new URL(src).hostname}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-cream px-3 py-2">
      <Icon size={13} className="mt-0.5 shrink-0 text-primary-500" />
      <dt className="shrink-0 text-xs font-semibold text-ink">{label} :</dt>
      <dd className="min-w-0 flex-1 text-xs text-ink-soft">{value}</dd>
    </div>
  )
}

function RatingFact({
  rating,
  userRatingCount,
}: {
  rating: number
  userRatingCount?: number | null
}) {
  const filled = Math.round(rating)
  return (
    <div className="flex items-start gap-2 rounded-xl bg-cream px-3 py-2 sm:col-span-2">
      <Star size={13} className="mt-0.5 shrink-0 fill-amber-400 text-amber-400" />
      <dt className="shrink-0 text-xs font-semibold text-ink">Note :</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-ink-soft">
        <span className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              size={12}
              className={i < filled ? 'fill-amber-400 text-amber-400' : 'text-ink-faint/40'}
            />
          ))}
        </span>
        <span className="font-semibold text-ink">{rating.toFixed(1)}</span>
        {userRatingCount != null && <span className="text-ink-faint">({userRatingCount})</span>}
      </dd>
    </div>
  )
}

function InfoTile({
  icon: Icon,
  label,
  value,
  onEdit,
}: {
  icon: typeof Clock
  label: string
  value: string
  onEdit?: () => void
}) {
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
        <Icon size={12} /> {label}
      </span>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </>
  )

  if (!onEdit) return <div className="rounded-xl bg-cream p-3">{content}</div>

  return (
    <button
      type="button"
      onClick={onEdit}
      className="group rounded-xl bg-cream p-3 text-left transition-colors hover:bg-primary-50"
    >
      {content}
      <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-primary-500 opacity-0 transition-opacity group-hover:opacity-100">
        <PencilLine size={10} /> Modifier
      </span>
    </button>
  )
}
