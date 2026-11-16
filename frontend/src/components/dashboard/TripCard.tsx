import { Calendar, Sparkles, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatMAD, tripProgress, type Trip } from '../../data/trips'
import PlaceImage from '../PlaceImage'
import StatusBadge from './StatusBadge'
import { VisitProgressBar } from './VisitProgress'

export default function TripCard({ trip }: { trip: Trip }) {
  const progress = tripProgress(trip)

  return (
    <Link
      to={`/dashboard/trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-shadow hover:shadow-card-lg"
    >
      <div className="relative h-40 overflow-hidden">
        <PlaceImage
          image={trip.coverImage}
          alt={trip.title}
          className="size-full transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
        <div className="absolute left-3 top-3">
          <StatusBadge status={trip.status} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-xs font-medium text-white/75">{trip.destinationLabel}</p>
          <p className="truncate font-display text-base font-bold text-white">{trip.title}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} className="text-ink-faint" /> {trip.dateRangeLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={13} className="text-ink-faint" /> {trip.travelers}
          </span>
        </div>

        {trip.status !== 'draft' && progress.total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-soft">Progression des visites</span>
              <span className="font-semibold text-ink">{progress.percentVisited}%</span>
            </div>
            <VisitProgressBar progress={progress} className="mt-1.5 h-1.5" />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-ink/5 pt-3 text-xs">
          <span className="flex items-center gap-1.5 text-ink-soft">
            <Sparkles size={13} className="text-primary-500" /> {trip.days.length} jour{trip.days.length > 1 ? 's' : ''} · {trip.activitiesRetained} activités
          </span>
          <span className="flex items-center gap-1 font-semibold text-ink">
            <Wallet size={12} className="text-ink-faint" /> {formatMAD(trip.budgetPerPersonMAD)}
          </span>
        </div>
      </div>
    </Link>
  )
}
