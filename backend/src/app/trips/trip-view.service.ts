import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActivitiesService } from 'src/app/activities/activities.service';
import { ActivityDocument } from 'src/app/activities/schemas/activity.schema';
import { RestaurantsService } from 'src/app/restaurants/restaurants.service';
import { RestaurantDocument } from 'src/app/restaurants/schemas/restaurant.schema';
import { BudgetService } from 'src/app/budget/budget.service';
import { BudgetCategory, BudgetLineItem } from 'src/app/budget/budget.types';
import { DashboardData, Itinerary } from 'src/app/ai/schemas';
import { localTransportMargin, TransportMode } from 'src/app/ai/transport-pricing.util';
import { Trip, TripDocument, TripStatusEnum } from './schemas/trip.schema';
import { TripActivity } from './schemas/trip-activity.schema';
import { TripsService } from './trips.service';
import { categoryLabel } from './category-labels';
import { WeatherStubService } from './weather-stub.service';
import {
  ActivityItemKind,
  ActivityItemStatusView,
  ActivityItemView,
  BudgetCategoryView,
  DayPlanView,
  PlaceImageView,
  PriceConfidenceView,
  TripStatusView,
  TripView,
} from './trip-view.dto';

// Flattened shape both a confirmed trip's TripActivity rows and a not-yet-
// confirmed trip's proposedItinerary JSON get normalised into, so the rest
// of the view-building logic below never needs to know which source it came
// from. This is what makes TripOverviewPage-style previews possible before
// the user hits "Valider".
interface NormalizedItem {
  tripActivityId: string;
  type: string;
  refId: string;
  day: number;
  city: string;
  startTime: string | null;
  durationMin: number | null;
  estimatedCost: number | null;
  costIsEstimate: boolean;
  priceConfidence: string | null;
  status: string;
  reason: string | null;
}

// Denormalized read model matching the frontend mock's Trip/DayPlan/
// ActivityItem contract (frontend/src/data/trips.ts). Always recomputes
// budget/itinerary live from current TripActivity + catalogue docs — never
// re-runs the LLM (trip.dashboard is only read for its frozen narrative
// text). See plan doc for the full rationale.
@Injectable()
export class TripViewService {
  constructor(
    @InjectModel(Trip.name) private readonly tripModel: Model<Trip>,
    @InjectModel(TripActivity.name) private readonly tripActivityModel: Model<TripActivity>,
    private readonly tripsService: TripsService,
    private readonly activitiesService: ActivitiesService,
    private readonly restaurantsService: RestaurantsService,
    private readonly budgetService: BudgetService,
    private readonly weatherStub: WeatherStubService,
  ) {}

  async getView(tripId: string, userId: string): Promise<TripView> {
    const trip = await this.tripsService.findOneForOwner(tripId, userId);
    return this.buildView(trip);
  }

  async listViews(userId: string): Promise<TripView[]> {
    const trips = await this.tripModel
      .find({ owner: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    return Promise.all(trips.map((t) => this.buildView(t)));
  }

  private async buildView(trip: TripDocument): Promise<TripView> {
    const tripActivities = await this.tripActivityModel.find({ trip: trip._id }).exec();
    const proposedItinerary = trip.proposedItinerary as unknown as Itinerary | null;
    const dashboard = trip.dashboard as unknown as DashboardData | null;

    const normalized: NormalizedItem[] = tripActivities.length
      ? tripActivities.map((ta) => ({
          tripActivityId: ta._id.toString(),
          type: ta.type,
          refId: ta.refId,
          day: ta.day,
          city: ta.city,
          startTime: ta.startTime,
          durationMin: ta.durationMin,
          estimatedCost: ta.estimatedCost,
          costIsEstimate: ta.costIsEstimate,
          priceConfidence: ta.priceConfidence,
          status: ta.status,
          reason: ta.reason,
        }))
      : (proposedItinerary?.days ?? []).flatMap((day, dayIdx) =>
          day.items.map((item, itemIdx) => ({
            tripActivityId: `proposal-${day.day}-${itemIdx}-${dayIdx}`,
            type: item.type,
            refId: item.activityId,
            day: day.day,
            city: day.city,
            startTime: item.startTime,
            durationMin: item.durationMin,
            estimatedCost: item.estimatedCost,
            costIsEstimate: item.costIsEstimate,
            priceConfidence: item.priceConfidence,
            status: 'to_visit',
            reason: item.reason,
          })),
        );

    const activityIds = [...new Set(normalized.filter((i) => i.type === 'activity').map((i) => i.refId))];
    const restaurantIds = [...new Set(normalized.filter((i) => i.type === 'restaurant').map((i) => i.refId))];
    const [activities, restaurants] = await Promise.all([
      activityIds.length ? this.activitiesService.findManyByIds(activityIds) : Promise.resolve([]),
      restaurantIds.length ? this.restaurantsService.findManyByIds(restaurantIds) : Promise.resolve([]),
    ]);
    const activityById = new Map(activities.map((a) => [a._id as unknown as string, a]));
    const restaurantById = new Map(restaurants.map((r) => [r._id as unknown as string, r]));

    const dashboardDayByNumber = new Map((dashboard?.itinerary ?? []).map((d) => [d.day, d]));

    const days: DayPlanView[] = [];
    for (let dayNumber = 1; dayNumber <= trip.durationDays; dayNumber++) {
      const dayItems = normalized
        .filter((i) => i.day === dayNumber)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      const city = dayItems[0]?.city ?? trip.cities[Math.min(dayNumber - 1, trip.cities.length - 1)] ?? trip.cities[0] ?? '';
      const date = addDays(trip.startDate, dayNumber - 1);
      const activityViews = dayItems.map((i) => this.buildActivityItem(i, activityById, restaurantById, trip.travelers));

      const narrativeDay = dashboardDayByNumber.get(dayNumber);
      const title = narrativeDay?.title || `Jour ${dayNumber} — ${city}`;
      const tags = narrativeDay?.tags?.length ? narrativeDay.tags : deriveTags(activityViews);
      const weather = this.weatherStub.forecast(city, date);
      const heroImage = activityViews.find((a) => a.image)?.image ?? null;

      days.push({
        id: `day-${dayNumber}`,
        dayNumber,
        date,
        city,
        title,
        tags,
        weatherC: weather.tempC,
        weatherLabel: weather.label,
        heroImage,
        activities: activityViews,
      });
    }

    const lines: BudgetLineItem[] = normalized.map((i) => ({
      tripActivityId: i.tripActivityId,
      category: categoryFor(i.type),
      day: i.day,
      cost: i.estimatedCost,
      isEstimate: i.costIsEstimate,
      priceConfidence: i.priceConfidence as 'high' | 'medium' | 'low' | null,
      label: i.refId,
    }));
    // The planner only ever prices explicit inter-city/airport transfers —
    // day-to-day local moves (petit taxi, city bus) are otherwise budgeted at
    // zero. Add a daily per-person margin so the total stays realistic
    // regardless of what transport items the itinerary actually contains.
    const dailyMargin = localTransportMargin(trip.transport as TransportMode | null, trip.travelers, 1);
    if (dailyMargin > 0) {
      for (let day = 1; day <= trip.durationDays; day++) {
        lines.push({
          tripActivityId: `local-transport-margin-${day}`,
          category: 'transport',
          day,
          cost: dailyMargin,
          isEstimate: true,
          priceConfidence: null,
          label: 'Transport local (marge)',
        });
      }
    }
    const budgetResult = this.budgetService.calculate(lines, trip.budgetTotal);
    const nights = Math.max(trip.durationDays - 1, 0);
    const hebergementAmount =
      budgetResult.byCategory.accommodation > 0
        ? Math.round(budgetResult.byCategory.accommodation / trip.travelers)
        : Math.round(nights * 175 * (trip.travelers >= 2 ? 1 : 1.4));
    const budgetCategories: BudgetCategoryView[] = [
      { key: 'hebergement', label: 'Hébergement', amount: hebergementAmount, color: 'var(--color-primary-400)' },
      {
        key: 'restauration',
        label: 'Restauration',
        amount: Math.round(budgetResult.byCategory.food / trip.travelers),
        color: 'var(--color-violet-400)',
      },
      {
        key: 'activites',
        label: 'Activités',
        amount: Math.round(budgetResult.byCategory.activities / trip.travelers),
        color: 'var(--color-teal-400)',
      },
      {
        key: 'transport',
        label: 'Transport',
        amount: Math.round(budgetResult.byCategory.transport / trip.travelers),
        color: 'var(--color-azure-400)',
      },
    ];
    const budgetPerPersonMAD = budgetCategories.reduce((s, c) => s + c.amount, 0);

    const activitiesRetained = normalized.length;
    const activitiesConsidered =
      (proposedItinerary?.summary?.activitiesConsidered as number | undefined) ?? Math.max(activitiesRetained, 1);
    const coverImage = days.find((d) => d.heroImage)?.heroImage ?? null;

    return {
      id: trip._id.toString(),
      status: deriveStatus(trip),
      destinationLabel: trip.cities.join(' · '),
      title: trip.title?.trim() || defaultTitle(trip.cities),
      dateRangeLabel: formatDateRange(trip.startDate, trip.durationDays),
      startDate: trip.startDate,
      travelers: trip.travelers,
      days,
      themes: trip.interests.length ? trip.interests.map(capitalize) : ['Culture'],
      activitiesRetained,
      activitiesConsidered,
      budgetPerPersonMAD,
      budgetCategories,
      budgetTotalMAD: trip.budgetTotal,
      budgetEstimatedMAD: budgetResult.estimated,
      budgetRemainingMAD: budgetResult.remaining,
      budgetAlerts: budgetResult.alerts,
      aiNote: dashboard?.overview?.summary?.trim() || defaultAiNote(trip),
      coverImage,
    };
  }

  private buildActivityItem(
    item: NormalizedItem,
    activityById: Map<string, ActivityDocument>,
    restaurantById: Map<string, RestaurantDocument>,
    travelers: number,
  ): ActivityItemView {
    const priceDisplay = item.estimatedCost != null ? Math.round(item.estimatedCost / travelers) : null;
    const priceConfidence = mapPriceConfidence(item.priceConfidence, item.costIsEstimate, item.estimatedCost);

    let name: string;
    let description: string;
    let category: string;
    let durationMin: number;
    let isFree: boolean;
    let image: PlaceImageView | null;
    let kind: ActivityItemKind;

    if (item.type === 'restaurant') {
      const doc = restaurantById.get(item.refId);
      name = doc?.name ?? item.refId;
      description = doc?.description ?? '';
      category = 'gastronomie';
      durationMin = item.durationMin ?? 60;
      isFree = priceDisplay === 0;
      image = mapImage(doc?.image);
      kind = 'restaurant';
    } else if (item.type === 'transport') {
      name = item.refId;
      description = item.reason ?? '';
      category = 'transport';
      durationMin = item.durationMin ?? 60;
      isFree = priceDisplay === 0;
      image = null;
      kind = 'transport';
    } else {
      // 'activity' and the unused 'accommodation' both render as a catalogue place.
      const doc = activityById.get(item.refId);
      name = doc?.name ?? item.refId;
      description = doc?.description ?? '';
      category = item.type === 'accommodation' ? 'hebergement' : (doc?.category ?? 'culture');
      durationMin = item.durationMin ?? doc?.duration ?? 60;
      isFree = doc?.isFree ?? priceDisplay === 0;
      image = mapImage(doc?.image);
      kind = 'activity';
    }

    const startTime = item.startTime ?? '09:00';
    const endTime = addMinutes(startTime, durationMin);

    return {
      id: item.tripActivityId,
      refId: item.refId,
      startTime,
      endTime,
      name,
      kind,
      category,
      categoryLabel: categoryLabel(category),
      description,
      durationMin,
      price: priceDisplay,
      priceConfidence,
      isFree,
      image,
      status: (item.status as ActivityItemStatusView) ?? 'to_visit',
    };
  }
}

function categoryFor(type: string): BudgetCategory {
  switch (type) {
    case 'transport':
      return 'transport';
    case 'accommodation':
      return 'accommodation';
    case 'restaurant':
      return 'food';
    default:
      return 'activities';
  }
}

function mapPriceConfidence(pc: string | null, isEstimate: boolean, cost: number | null): PriceConfidenceView {
  if (pc === 'high' || pc === 'medium' || pc === 'low') return pc;
  if (cost === null) return 'unknown';
  return isEstimate ? 'estimated' : 'unknown';
}

function mapImage(img: { url?: string | null; credit?: string | null; license?: string | null } | undefined | null): PlaceImageView | null {
  if (!img?.url) return null;
  return { url: img.url, credit: img.credit ?? '', license: img.license ?? '' };
}

function deriveTags(items: ActivityItemView[]): string[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    if (i.kind === 'transport') continue;
    counts.set(i.categoryLabel, (counts.get(i.categoryLabel) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label]) => label);
}

function deriveStatus(trip: TripDocument): TripStatusView {
  if (trip.status === TripStatusEnum.CONFIRMED) {
    return new Date(trip.endDate).getTime() < Date.now() ? 'completed' : 'confirmed';
  }
  return 'draft';
}

function defaultTitle(cities: string[]): string {
  const primary = cities[0] ?? 'Maroc';
  if (cities.length > 1) return `Mon voyage au Maroc — ${cities.join(' · ')}`;
  return `Mon voyage à ${primary}`;
}

function defaultAiNote(trip: TripDocument): string {
  const interestsLabel = trip.interests.length ? trip.interests.join(', ').toLowerCase() : 'vos envies';
  const travelerSuffix = trip.travelers > 1 ? 's' : '';
  return (
    `Basé sur vos préférences : ${interestsLabel}, pour ${trip.travelers} voyageur${travelerSuffix} ` +
    `avec un budget cible d'environ ${trip.budgetTotal.toLocaleString('fr-FR')} ${trip.currency} au total.`
  );
}

function capitalize(s: string): string {
  const clean = s.replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function formatDateRange(startDate: string, days: number): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(days - 1, 0));
  const startLabel = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const endLabel = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

function addDays(startDate: string, offset: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function timeToMinutes(hhmm: string | null): number {
  if (!hhmm) return 24 * 60;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutes(hhmm: string, minutes: number): string {
  return minutesToTime(timeToMinutes(hhmm) + minutes);
}
