import OpenAI from 'openai';
import { ActivitiesService } from 'src/app/activities/activities.service';
import { RestaurantsService } from 'src/app/restaurants/restaurants.service';
import { ACTIVITY_CATEGORIES } from 'src/app/activities/schemas/activity.schema';
import { BudgetService } from 'src/app/budget/budget.service';
import { RetrievalService } from './retrieval.service';
import { ScoringService } from './scoring.service';
import { haversineKm } from './scoring.service';
import { TripProfile } from './schemas';
import { estimateIntercityTransport, estimateTransportCost, IntercityPreference, TransportMode } from './transport-pricing.util';

export const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'searchActivities',
      description: 'Recherche des activités réelles en base pour une ville et une intention.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          query: { type: 'string', description: 'Intention en langage naturel' },
          maxPrice: { type: ['number', 'null'] },
          freeOnly: { type: ['boolean', 'null'] },
          category: { type: ['string', 'null'], enum: [...ACTIVITY_CATEGORIES, null] },
        },
        required: ['city', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchRestaurants',
      description: 'Recherche des restaurants réels en base pour une ville.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          cuisine: { type: ['string', 'null'] },
          priceLevel: { type: ['string', 'null'], enum: ['$', '$$', '$$$', '$$$$', null] },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchAccommodations',
      description: 'Recherche des logements pour une ville. Non couvert par le dataset actuel.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          maxPricePerNight: { type: 'number' },
        },
        required: ['city', 'maxPricePerNight'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDistance',
      description: 'Distance et temps de trajet estimés entre deux lieux (activité ou restaurant) déjà connus.',
      parameters: {
        type: 'object',
        properties: {
          fromId: { type: 'string' },
          toId: { type: 'string' },
        },
        required: ['fromId', 'toId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimateTransportCost',
      description: 'Coût de transport estimé (MAD) entre deux lieux ou villes.',
      parameters: {
        type: 'object',
        properties: {
          fromCity: { type: 'string' },
          toCity: { type: 'string' },
          mode: { type: 'string', enum: ['car', 'public', 'walk', 'mixed'] },
        },
        required: ['fromCity', 'toCity', 'mode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimateIntercityTransport',
      description:
        "Options réelles (train, bus, taxi partagé) pour un trajet entre deux villes, avec prix (MAD) et durée. " +
        "Utilise cet outil — pas estimateTransportCost — pour tout trajet inter-villes ; il renvoie toutes les " +
        "options sourcées plus une recommandation qui respecte la préférence du voyageur (profil.intercityTransport).",
      parameters: {
        type: 'object',
        properties: {
          fromCity: { type: 'string' },
          toCity: { type: 'string' },
          mode: {
            type: ['string', 'null'],
            enum: ['train', 'bus', 'taxi', 'any', null],
            description: 'Omets ce champ (ou "any") pour laisser la recommandation suivre le profil du voyageur.',
          },
        },
        required: ['fromCity', 'toCity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculateBudget',
      description: 'Calcule les totaux de budget (jour/séjour) pour une liste d\'items sélectionnés.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                refId: { type: 'string' },
                type: { type: 'string', enum: ['activity', 'restaurant'] },
                day: { type: 'number' },
              },
              required: ['refId', 'type', 'day'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
];

// Candidates handed back per search call. Each tool result is re-sent with
// every subsequent turn of the agent loop, so this number multiplies across a
// run — the cap keeps a multi-city trip inside the provider's token budget.
const MAX_TOOL_RESULTS = 10;

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

// Plain helper class, not a Nest provider (S2 only governs DI-managed
// singletons) — instantiated fresh per agent run in AiOrchestrator so the
// "seen candidate ids" guard rail never leaks across requests.
export class ToolDispatcher {
  private readonly seenIds = new Set<string>();

  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly restaurantsService: RestaurantsService,
    private readonly retrievalService: RetrievalService,
    private readonly scoringService: ScoringService,
    private readonly budgetService: BudgetService,
    private readonly profile: TripProfile,
  ) {}

  async dispatch(name: string, args: Record<string, any>): Promise<unknown> {
    switch (name) {
      case 'searchActivities':
        return this.searchActivities(args);
      case 'searchRestaurants':
        return this.searchRestaurants(args);
      case 'searchAccommodations':
        return { items: [], note: 'Logements non couverts par le dataset actuel (voir guide §11.6).' };
      case 'getDistance':
        return this.getDistance(args.fromId, args.toId);
      case 'estimateTransportCost':
        return this.estimateTransportCost(args.fromCity, args.toCity, args.mode);
      case 'estimateIntercityTransport':
        return this.estimateIntercityTransport(args.fromCity, args.toCity, args.mode);
      case 'calculateBudget':
        return this.calculateBudget(args.items);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // Ids this dispatcher has actually returned to the model — used to
  // reject a hallucinated id before it reaches the final Itinerary (§2
  // rule 2, guide Étape F).
  hasSeen(refId: string): boolean {
    return this.seenIds.has(refId);
  }

  private async searchActivities(args: Record<string, any>) {
    const candidates = await this.retrievalService.search(this.profile, args.city);
    const filtered = candidates.filter((c) => {
      if (args.freeOnly && !c.isFree) return false;
      if (args.category && c.category !== args.category) return false;
      if (args.maxPrice != null && !c.isFree) {
        const cost = c.price ?? c.priceRange?.[1] ?? null;
        if (cost !== null && cost > args.maxPrice) return false;
      }
      return true;
    });

    const ranked = await this.retrievalService.rerank(this.profile, args.city, filtered);
    const perActivityBudget = this.profile.budgetTotal / (this.profile.durationDays ?? 1) / 2;
    const scored = this.scoringService.score(
      { interests: this.profile.interests, avoid: this.profile.avoid, perActivityBudget },
      ranked,
    );

    const byId = new Map(filtered.map((c) => [c.refId, c]));
    scored.forEach((s) => this.seenIds.add(s.refId));

    return scored
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, MAX_TOOL_RESULTS)
      .map((s) => {
        const c = byId.get(s.refId)!;
        // Deliberately narrow: whole catalogue rows (sources, priceNote, image,
        // coordinates, tags) ran the context into the provider's per-minute
        // token cap on multi-city trips. These are the fields the planner
        // actually reasons over — everything else is re-joined from the
        // database when the view is built, so nothing is lost downstream.
        return {
          refId: c.refId,
          name: c.name,
          category: c.category,
          description: truncate(c.description, 140),
          price: c.price,
          isFree: c.isFree,
          priceConfidence: c.priceConfidence,
          durationMin: c.duration,
          openingHours: truncate(c.openingHours, 80),
          touristLevel: c.touristLevel,
          requiresBooking: c.requiresBooking,
          matchScore: s.matchScore,
        };
      });
  }

  private async searchRestaurants(args: Record<string, any>) {
    const page = await this.restaurantsService.paginate({
      city: args.city,
      cuisine: args.cuisine,
      priceLevel: args.priceLevel,
      page: 1,
      limit: MAX_TOOL_RESULTS,
      sort: {},
    } as any);
    page.items.forEach((r) => this.seenIds.add(r._id as unknown as string));

    // Same narrowing as searchActivities — returning hydrated documents
    // serialized every field, sources and image metadata included.
    return page.items.map((r) => ({
      refId: r._id as unknown as string,
      name: r.name,
      cuisine: r.cuisine,
      description: truncate(r.description, 140),
      priceLevel: r.priceLevel,
      avgPricePerPerson: r.avgPricePerPerson,
      openingHours: truncate(r.openingHours, 80),
    }));
  }

  private async getDistance(fromId: string, toId: string) {
    const [from, to] = await Promise.all([this.findCoordinates(fromId), this.findCoordinates(toId)]);
    if (!from || !to) return { km: null, minutes: null, note: 'Coordonnées manquantes.' };
    const km = haversineKm(from, to);
    return { km: Math.round(km * 10) / 10, minutes: Math.round((km / 30) * 60) }; // ~30 km/h city average
  }

  private async findCoordinates(refId: string): Promise<{ lat: number; lng: number } | null> {
    const activity = await this.activitiesService.findManyByIds([refId]);
    if (activity[0]?.coordinates) return activity[0].coordinates;
    const restaurant = await this.restaurantsService.findManyByIds([refId]);
    return restaurant[0]?.coordinates ?? null;
  }

  private estimateTransportCost(fromCity: string, toCity: string, mode: TransportMode) {
    return estimateTransportCost(fromCity, toCity, mode);
  }

  private estimateIntercityTransport(fromCity: string, toCity: string, mode?: IntercityPreference | null) {
    const preferred = mode ?? (this.profile.intercityTransport as IntercityPreference | null) ?? 'any';
    return estimateIntercityTransport(fromCity, toCity, preferred);
  }

  private calculateBudget(items: { refId: string; type: 'activity' | 'restaurant'; day: number }[]) {
    return Promise.all(
      items.map(async (item) => {
        if (item.type === 'activity') {
          const [activity] = await this.activitiesService.findManyByIds([item.refId]);
          if (!activity) return { tripActivityId: item.refId, category: 'activities' as const, day: item.day, cost: null, isEstimate: false, priceConfidence: null, label: item.refId };
          const { cost, isEstimate } = this.budgetService.resolveActivityCost({
            isFree: activity.isFree,
            price: activity.price,
            priceRange: activity.priceRange,
            priceConfidence: activity.priceConfidence,
            travelers: this.profile.travelers,
          });
          return {
            tripActivityId: item.refId,
            category: 'activities' as const,
            day: item.day,
            cost,
            isEstimate,
            priceConfidence: activity.priceConfidence,
            label: activity.name,
          };
        }
        const [restaurant] = await this.restaurantsService.findManyByIds([item.refId]);
        if (!restaurant) return { tripActivityId: item.refId, category: 'food' as const, day: item.day, cost: null, isEstimate: false, priceConfidence: null, label: item.refId };
        const { cost, isEstimate } = this.budgetService.resolveRestaurantCost({
          priceLevel: restaurant.priceLevel,
          avgPricePerPerson: restaurant.avgPricePerPerson,
          travelers: this.profile.travelers,
        });
        return {
          tripActivityId: item.refId,
          category: 'food' as const,
          day: item.day,
          cost,
          isEstimate,
          priceConfidence: null,
          label: restaurant.name,
        };
      }),
    ).then((lines) => this.budgetService.calculate(lines, this.profile.budgetTotal));
  }
}
