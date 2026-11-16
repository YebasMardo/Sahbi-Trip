import { CheckCircle2, Clock, MapPin, MoreVertical, PencilLine, Repeat, Sparkles, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_ORDER,
  activityStatus,
  formatDuration,
  formatMAD,
  type ActivityItem,
  type ActivityItemStatus,
} from '../../data/trips'
import PlaceImage from '../PlaceImage'

const CATEGORY_BADGE: Record<string, string> = {
  culture: 'bg-primary-50 text-primary-600',
  histoire: 'bg-primary-50 text-primary-600',
  nature: 'bg-teal-50 text-teal-500',
  gastronomie: 'bg-violet-50 text-violet-500',
  shopping: 'bg-rose-50 text-rose-500',
  plage: 'bg-azure-50 text-azure-500',
  promenade: 'bg-teal-50 text-teal-500',
  transport: 'bg-ink/5 text-ink-soft',
}

const STATUS_BADGE: Record<ActivityItemStatus, string> = {
  to_visit: 'bg-cream text-ink-soft',
  confirmed: 'bg-primary-50 text-primary-600',
  visited: 'bg-teal-50 text-teal-600',
  missed: 'bg-rose-50 text-rose-500',
}

const STATUS_DOT: Record<ActivityItemStatus, string> = {
  to_visit: 'border-ink/25 bg-white',
  confirmed: 'border-primary-500 bg-primary-100',
  visited: 'border-teal-500 bg-teal-400',
  missed: 'border-rose-400 bg-rose-50',
}

function priceLabel(item: ActivityItem): string {
  if (item.isFree) return 'Gratuit'
  if (item.price == null) return 'Non renseigné'
  return `${formatMAD(item.price)}${item.priceConfidence === 'estimated' ? ' (est.)' : ''}`
}

export default function ActivityTimelineItem({
  item,
  isLast,
  detailHref,
  onReplace,
  onSuggestAlternatives,
  onDelete,
  onChangeStatus,
  onEditTime,
}: {
  item: ActivityItem
  isLast: boolean
  detailHref: string
  onReplace?: () => void
  /** Asks the AI for alternatives instead of picking one by hand. */
  onSuggestAlternatives?: () => void
  onDelete?: () => void
  onChangeStatus?: (status: ActivityItemStatus) => void
  onEditTime?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = activityStatus(item)
  const canReplace = item.kind === 'activity' && onReplace
  const canSuggest = item.kind === 'activity' && onSuggestAlternatives

  return (
    <div className="flex gap-4">
      <div className="flex w-14 shrink-0 flex-col items-center pt-1 text-right">
        <button
          type="button"
          onClick={onEditTime}
          disabled={!onEditTime}
          title={onEditTime ? 'Modifier les horaires' : undefined}
          className="group/time flex flex-col items-center rounded-lg px-1 py-0.5 transition-colors enabled:hover:bg-primary-50"
        >
          <span className="text-xs font-semibold text-ink group-hover/time:text-primary-600">{item.startTime}</span>
          <span className="text-[11px] text-ink-faint">{item.endTime}</span>
          {onEditTime && (
            <span className="mt-0.5 hidden items-center gap-0.5 text-[10px] font-medium text-primary-500 group-hover/time:flex">
              <PencilLine size={9} /> Modifier
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-col items-center">
        <span className={`mt-1 size-2.5 shrink-0 rounded-full border-2 ${STATUS_DOT[status]}`} />
        {!isLast && <span className="w-px flex-1 bg-ink/10" />}
      </div>

      <div className={`relative flex flex-1 gap-3.5 rounded-2xl bg-white p-3.5 shadow-card sm:gap-4 ${isLast ? '' : 'mb-4'}`}>
        <Link to={detailHref} className="shrink-0">
          <PlaceImage
            image={item.image}
            category={item.category}
            alt={item.name}
            className="size-20 shrink-0 rounded-xl sm:size-24"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={detailHref} className="truncate font-display text-sm font-bold text-ink hover:text-primary-600 sm:text-[15px]">
                  {item.name}
                </Link>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_BADGE[item.category] ?? 'bg-ink/5 text-ink-soft'}`}>
                  {item.categoryLabel}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[status]}`}>
                  {ACTIVITY_STATUS_LABELS[status]}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft sm:text-[13px]">
                {item.description}
              </p>
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="Plus d'options"
                onClick={() => setMenuOpen((v) => !v)}
                className="text-ink-faint hover:text-ink-soft"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-6 z-20 w-52 overflow-hidden rounded-xl bg-white py-1.5 shadow-card-lg ring-1 ring-ink/5">
                    <Link
                      to={detailHref}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-ink hover:bg-cream"
                    >
                      <MapPin size={13} /> Voir les détails
                    </Link>
                    {onEditTime && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onEditTime()
                        }}
                        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-ink hover:bg-cream"
                      >
                        <PencilLine size={13} /> Modifier les horaires
                      </button>
                    )}
                    {canReplace && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onReplace?.()
                        }}
                        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-ink hover:bg-cream"
                      >
                        <Repeat size={13} /> Remplacer par un autre lieu
                      </button>
                    )}
                    {canSuggest && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onSuggestAlternatives?.()
                        }}
                        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-violet-600 hover:bg-violet-50"
                      >
                        <Sparkles size={13} /> Suggestions de l'IA
                      </button>
                    )}
                    <div className="my-1 border-t border-ink/5" />
                    <p className="px-3.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                      Visite
                    </p>
                    {ACTIVITY_STATUS_ORDER.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onChangeStatus?.(s)
                        }}
                        className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium hover:bg-cream ${
                          s === status ? 'text-primary-600' : 'text-ink'
                        }`}
                      >
                        <CheckCircle2 size={13} /> {ACTIVITY_STATUS_LABELS[s]}
                      </button>
                    ))}
                    <div className="my-1 border-t border-ink/5" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onDelete?.()
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 size={13} /> Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-faint sm:text-xs">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {formatDuration(item.durationMin)}
            </span>
            <span className="flex items-center gap-1">
              <Wallet size={12} /> {priceLabel(item)}
            </span>
            <button
              type="button"
              className="ml-auto flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 font-medium text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600"
            >
              <MapPin size={12} /> Voir sur la carte
            </button>
          </div>

          {onChangeStatus && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-ink/5 pt-2.5">
              {ACTIVITY_STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChangeStatus(s)}
                  aria-pressed={s === status}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    s === status
                      ? STATUS_BADGE[s]
                      : 'bg-white text-ink-faint ring-1 ring-ink/10 hover:bg-cream hover:text-ink-soft'
                  }`}
                >
                  {ACTIVITY_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
