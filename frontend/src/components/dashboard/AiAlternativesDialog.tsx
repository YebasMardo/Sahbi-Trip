import { Check, Loader2, Sparkles, Wallet, X } from 'lucide-react'
import { errorMessage } from '../QueryState'
import { formatMAD } from '../../data/trips'
import { useGetActivityQuery } from '../../features/trips/trips.apiSlice'
import type { ReplaceAlternative } from '../../features/trips/trips.types'
import PlaceImage from '../PlaceImage'

/**
 * Shows the three alternatives the AI proposed for one itinerary item
 * (POST /trips/:id/activities/:taId/replace). That endpoint only *suggests* —
 * applying a choice is a separate PATCH, which `onApply` performs.
 */
export default function AiAlternativesDialog({
  alternatives,
  isLoading,
  error,
  isApplying,
  onApply,
  onClose,
}: {
  alternatives: ReplaceAlternative[]
  isLoading: boolean
  error: unknown
  isApplying: boolean
  onApply: (activityId: string) => void
  onClose: () => void
}) {
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
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <Sparkles size={17} className="text-violet-500" /> Suggestions de l'IA
            </h3>
            <p className="mt-0.5 text-xs text-ink-soft">
              Alternatives de la même ville, compatibles avec votre budget.
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

        <div className="flex-1 overflow-y-auto p-5 sm:px-6">
          {isLoading ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-cream px-4 py-8 text-sm text-ink-soft">
              <Loader2 size={14} className="animate-spin" /> L'IA cherche des alternatives…
            </p>
          ) : error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-6 text-center text-sm text-rose-600">
              {errorMessage(error) ?? "L'IA n'a pas pu proposer d'alternative."}
            </p>
          ) : alternatives.length === 0 ? (
            <p className="rounded-2xl bg-cream px-4 py-6 text-center text-sm text-ink-soft">
              Aucune alternative trouvée. Utilisez « Remplacer » pour choisir vous-même.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {alternatives.map((alt) => (
                <AlternativeRow
                  key={alt.activityId}
                  alternative={alt}
                  isApplying={isApplying}
                  onApply={() => onApply(alt.activityId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Resolves one suggestion's catalogue record — the replace endpoint returns
 * only an id and a reason, so the name, photo and price are fetched here.
 * One component per row keeps the hook call legal.
 */
function AlternativeRow({
  alternative,
  isApplying,
  onApply,
}: {
  alternative: ReplaceAlternative
  isApplying: boolean
  onApply: () => void
}) {
  const { data, isLoading } = useGetActivityQuery(alternative.activityId)
  const activity = data?.data

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-ink/5 bg-white p-3 shadow-card">
      <PlaceImage
        image={
          activity?.image?.url
            ? { url: activity.image.url, credit: activity.image.credit ?? '', license: activity.image.license ?? '' }
            : null
        }
        category={activity?.category}
        alt={activity?.name ?? alternative.activityId}
        className="size-16 shrink-0 rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {isLoading ? 'Chargement…' : (activity?.name ?? alternative.activityId)}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{alternative.reason}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint">
          <Wallet size={11} />{' '}
          {activity?.isFree
            ? 'Gratuit'
            : activity?.price != null
              ? formatMAD(activity.price)
              : 'Prix non renseigné'}
        </p>
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={isApplying || isLoading}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-600 disabled:opacity-50"
      >
        {isApplying ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Choisir
      </button>
    </div>
  )
}
