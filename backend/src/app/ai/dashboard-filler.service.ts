import { Injectable, Logger } from '@nestjs/common';
import { ActivitiesService } from 'src/app/activities/activities.service';
import { RestaurantsService } from 'src/app/restaurants/restaurants.service';
import { BudgetService } from 'src/app/budget/budget.service';
import { BudgetLineItem } from 'src/app/budget/budget.types';
import { LlmClient } from './llm.client';
import { haversineKm } from './scoring.service';
import { DashboardData, DashboardDataSchema } from './schemas';

export interface DashboardInputItem {
  tripActivityId: string;
  refId: string;
  type: 'activity' | 'restaurant';
  day: number;
  city: string;
  startTime: string | null;
  estimatedCost: number | null;
  costIsEstimate: boolean;
  priceConfidence: 'high' | 'medium' | 'low' | null;
}

export interface DashboardFillParams {
  version: number;
  scope: 'all' | 'day';
  travelers: number;
  budgetTotal: number;
  language: string;
  items: DashboardInputItem[];
}

@Injectable()
export class DashboardFillerService {
  private readonly logger = new Logger(DashboardFillerService.name);

  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly restaurantsService: RestaurantsService,
    private readonly budgetService: BudgetService,
    private readonly llmClient: LlmClient,
  ) {}

  // Guide §8 Étape G. The validated selection is never modified here —
  // this only fills and writes text. Code sections (budget/itinerary/map)
  // are computed first and are authoritative; the LLM only produces the
  // narrative sections (overview/checklist/tips), and if that call fails
  // the dashboard is still returned in "code-only" degraded mode
  // (guide: "le dashboard est rempli en code-only ... sans bloquer l'utilisateur").
  async fill(params: DashboardFillParams): Promise<DashboardData> {
    const activityIds = params.items.filter((i) => i.type === 'activity').map((i) => i.refId);
    const restaurantIds = params.items.filter((i) => i.type === 'restaurant').map((i) => i.refId);
    const [activities, restaurants] = await Promise.all([
      this.activitiesService.findManyByIds(activityIds),
      this.restaurantsService.findManyByIds(restaurantIds),
    ]);
    const activityById = new Map(activities.map((a) => [a._id as unknown as string, a]));
    const restaurantById = new Map(restaurants.map((r) => [r._id as unknown as string, r]));

    const budget = this.buildBudget(params);
    const { itinerary, map } = this.buildItineraryAndMap(params, activityById, restaurantById);
    const warnings = [...budget.alerts];

    const narrative = await this.generateNarrative(params, activityById, restaurantById).catch((error) => {
      this.logger.warn(`Dashboard narrative generation failed, degrading to code-only: ${(error as Error)?.message}`);
      return null;
    });

    // Editorial per-day title/tags, if the narrative call produced them —
    // left null/[] otherwise (zod defaults), TripViewService falls back to a
    // deterministic form at read time (never blocks on this being absent).
    const narrativeDayByNumber = new Map((narrative?.days ?? []).map((d) => [d.day, d]));
    const itineraryWithNarrative = itinerary.map((day) => ({
      ...day,
      title: narrativeDayByNumber.get(day.day)?.title ?? null,
      tags: narrativeDayByNumber.get(day.day)?.tags ?? [],
    }));

    const dashboard: DashboardData = {
      version: params.version,
      scope: params.scope,
      overview: narrative?.overview ?? {
        title: `Voyage ${params.items.length ? '— ' + [...new Set(params.items.map((i) => i.city))].join(', ') : ''}`,
        summary: '',
        highlights: [],
      },
      budget: {
        total: budget.total,
        estimated: budget.estimated,
        remaining: budget.remaining,
        byCategory: budget.byCategory,
        byDay: budget.byDay,
        alerts: budget.alerts,
      },
      itinerary: itineraryWithNarrative,
      map,
      logistics: { accommodations: [], intercity: [] }, // no accommodations in the MVP dataset (guide §11.6)
      checklist: narrative?.checklist ?? this.fallbackChecklist(params, activityById, restaurantById),
      tips: narrative?.tips ?? [],
      warnings,
      generatedAt: new Date().toISOString(),
    };

    return DashboardDataSchema.parse(dashboard);
  }

  private buildBudget(params: DashboardFillParams) {
    const lines: BudgetLineItem[] = params.items.map((item) => ({
      tripActivityId: item.tripActivityId,
      category: item.type === 'activity' ? 'activities' : 'food',
      day: item.day,
      cost: item.estimatedCost,
      isEstimate: item.costIsEstimate,
      priceConfidence: item.priceConfidence,
      label: item.refId,
    }));
    return this.budgetService.calculate(lines, params.budgetTotal);
  }

  private buildItineraryAndMap(
    params: DashboardFillParams,
    activityById: Map<string, any>,
    restaurantById: Map<string, any>,
  ) {
    const byDay = new Map<number, DashboardInputItem[]>();
    for (const item of params.items) {
      byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
    }

    const markers: DashboardData['map']['markers'] = [];
    let order = 0;

    const itinerary = [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, items]) => {
        let previousCoords: { lat: number; lng: number } | null = null;
        const dayItems = items.map((item) => {
          const coords = this.resolveCoordinates(item, activityById, restaurantById);
          const travelFromPrevious =
            previousCoords && coords
              ? { km: Math.round(haversineKm(previousCoords, coords) * 10) / 10, minutes: null, cost: null }
              : null;
          if (coords) {
            order += 1;
            markers.push({ tripActivityId: item.tripActivityId, lat: coords.lat, lng: coords.lng, order });
            previousCoords = coords;
          }
          return { tripActivityId: item.tripActivityId, startTime: item.startTime, travelFromPrevious };
        });
        return { day, city: items[0].city, items: dayItems };
      });

    return { itinerary, map: { markers } };
  }

  private resolveCoordinates(
    item: DashboardInputItem,
    activityById: Map<string, any>,
    restaurantById: Map<string, any>,
  ): { lat: number; lng: number } | null {
    const doc = item.type === 'activity' ? activityById.get(item.refId) : restaurantById.get(item.refId);
    return doc?.coordinates ?? null;
  }

  private fallbackChecklist(
    params: DashboardFillParams,
    activityById: Map<string, any>,
    restaurantById: Map<string, any>,
  ): DashboardData['checklist'] {
    return params.items
      .filter((item) => item.type === 'activity' && activityById.get(item.refId)?.requiresBooking)
      .map((item) => ({
        label: `Réserver : ${activityById.get(item.refId)?.name ?? item.refId}`,
        type: 'booking' as const,
        dayRef: item.day,
      }));
  }

  private async generateNarrative(
    params: DashboardFillParams,
    activityById: Map<string, any>,
    restaurantById: Map<string, any>,
  ): Promise<{
    overview: DashboardData['overview'];
    checklist: DashboardData['checklist'];
    tips: DashboardData['tips'];
    days: { day: number; title: string; tags: string[] }[];
  }> {
    const catalogue = params.items.map((item) => {
      const doc = item.type === 'activity' ? activityById.get(item.refId) : restaurantById.get(item.refId);
      return {
        tripActivityId: item.tripActivityId,
        day: item.day,
        city: item.city,
        name: doc?.name,
        type: item.type,
        requiresBooking: doc?.requiresBooking ?? false,
        website: doc?.website ?? null,
        phone: doc?.phone ?? null,
        tags: doc?.tags ?? [],
        openingHours: doc?.openingHours ?? null,
      };
    });

    const systemPrompt =
      'Tu rédiges le résumé, la checklist, les conseils et un titre + tags éditoriaux par jour ' +
      "pour un voyage déjà validé. Tu ne modifies jamais la sélection fournie et n'ajoutes aucune activité. " +
      'Réponds UNIQUEMENT avec un JSON : { "overview": { "title": string, "summary": string, "highlights": string[] }, ' +
      '"checklist": [ { "label": string, "type": "booking"|"reminder"|"packing", "dayRef": number|null } ], ' +
      '"tips": [ { "city": string, "text": string } ], ' +
      '"days": [ { "day": number, "title": string, "tags": string[] } ] }. ' +
      '"days[].title" : titre court et évocateur pour la journée (ex. "Marrakech — Jardins et médersa"), ' +
      'basé sur les lieux réellement présents ce jour-là. "days[].tags" : 2 à 4 mots-clés courts ' +
      '(ex. "Culture", "Nature") reflétant les catégories des lieux du jour. Un objet par jour présent ' +
      'dans la sélection. Aucun texte hors JSON.';

    const res = await this.llmClient.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Langue : ${params.language}. Sélection validée : ${JSON.stringify(catalogue)}` },
      ],
      undefined,
      // 2048, not 1024: the response now also carries a per-day title/tags
      // object, which pushed multi-day trips past the old cap and truncated
      // the JSON mid-array (degrading to code-only fallback every time).
      { temperature: 0.4, maxTokens: 2048 },
    );

    const content = res.choices[0]?.message?.content ?? '';
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('LLM did not return JSON.');
    return JSON.parse(content.slice(start, end + 1));
  }
}
