import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import { ActivitiesService } from 'src/app/activities/activities.service';
import { RestaurantsService } from 'src/app/restaurants/restaurants.service';
import { BudgetService } from 'src/app/budget/budget.service';
import { BudgetLineItem } from 'src/app/budget/budget.types';
import { AiOrchestrator } from './ai.orchestrator';
import { ToolDispatcher } from './ai.tools';
import { Itinerary, ItinerarySchema, TripProfile } from './schemas';
import { localTransportMargin, TransportMode } from './transport-pricing.util';

const PLAN_ITINERARY_PROMPT = readFileSync(join(__dirname, 'prompts', 'plan-itinerary.md'), 'utf-8');
const REPLACE_ACTIVITY_PROMPT = readFileSync(join(__dirname, 'prompts', 'replace-activity.md'), 'utf-8');
const OPTIMIZE_PROMPT = readFileSync(join(__dirname, 'prompts', 'optimize.md'), 'utf-8');
const MAX_RETRIES = 2;

export interface OptimizableItem {
  tripActivityId: string;
  refId: string;
  type: 'activity' | 'restaurant';
  startTime: string | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly orchestrator: AiOrchestrator,
    private readonly activitiesService: ActivitiesService,
    private readonly restaurantsService: RestaurantsService,
    private readonly budgetService: BudgetService,
  ) {}

  // Guide §8 Étapes B-F: retrieval + rerank happen inside the tool calls the
  // agent makes; this method drives the agent, then validates and
  // recomputes the budget in code (source of truth, never the LLM's math).
  async generateItinerary(profile: TripProfile): Promise<Itinerary> {
    const userMessage = this.buildProfileMessage(profile);
    let lastWarning: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const messages = [
        { role: 'system' as const, content: PLAN_ITINERARY_PROMPT },
        { role: 'user' as const, content: attempt === 0 ? userMessage : `${userMessage}\n\nContrainte supplémentaire : ${lastWarning}` },
      ];

      // One failed attempt must not sink the whole request: a transient
      // provider error or a run that spends its tool budget is retried with a
      // tighter instruction, and only an exhausted retry budget gives up.
      let content: string;
      let dispatcher: ToolDispatcher;
      try {
        ({ content, dispatcher } = await this.orchestrator.run(messages, profile));
      } catch (error) {
        // A provider outage or rate limit is already a typed HttpException
        // (LlmClient.translateProviderError) — retrying it immediately only
        // makes a 429 worse, so surface it as-is.
        if (error instanceof HttpException) throw error;
        this.logger.warn(`Itinerary generation attempt ${attempt} failed: ${(error as Error)?.message}`);
        lastWarning =
          'Limite-toi à un seul appel searchActivities par ville, puis produis directement le JSON final.';
        continue;
      }

      const parsed = safeJsonParse(content);
      const result = parsed ? ItinerarySchema.safeParse(parsed) : null;

      if (!result?.success) {
        this.logger.warn(
          `Itinerary generation attempt ${attempt} produced invalid JSON: ${
            result ? JSON.stringify(result.error.issues.slice(0, 3)) : 'no JSON object found'
          }`,
        );
        lastWarning = 'Le budget doit être strictement respecté et le JSON doit être valide.';
        continue;
      }

      const itinerary = this.dropUnknownIds(result.data, dispatcher);
      const recomputed = await this.recomputeBudget(itinerary, profile);

      if (recomputed.budget.remaining < 0 && attempt < MAX_RETRIES) {
        lastWarning = `Budget dépassé de ${Math.abs(recomputed.budget.remaining)} MAD — réduis la sélection.`;
        continue;
      }
      return recomputed;
    }

    throw new BadRequestException(
      "L'IA n'a pas pu produire un itinéraire valide dans le budget donné après plusieurs tentatives.",
    );
  }

  async replaceActivity(params: {
    city: string;
    category: string;
    excludeRefId: string;
    maxPrice?: number;
    profile: TripProfile;
  }): Promise<{ activityId: string; reason: string }[]> {
    const message =
      `Ville : ${params.city}. Catégorie recherchée : ${params.category}. ` +
      `Exclure l'activité ${params.excludeRefId}.` +
      (params.maxPrice ? ` Budget max par personne : ${params.maxPrice} MAD.` : '');

    const { content } = await this.orchestrator.run(
      [
        { role: 'system', content: REPLACE_ACTIVITY_PROMPT },
        { role: 'user', content: message },
      ],
      params.profile,
    );

    const parsed = safeJsonParse(content) as { alternatives?: { activityId: string; reason: string }[] } | null;
    return parsed?.alternatives?.slice(0, 3) ?? [];
  }

  async optimizeDay(params: {
    city: string;
    profile: TripProfile;
    items: OptimizableItem[];
  }): Promise<{ order: { tripActivityId: string; startTime: string }[]; explanation: string }> {
    const message = `Ville : ${params.city}. Items à réordonner (tripActivityId, refId) : ${JSON.stringify(
      params.items.map((i) => ({ tripActivityId: i.tripActivityId, refId: i.refId, startTime: i.startTime })),
    )}`;

    const { content } = await this.orchestrator.run(
      [
        { role: 'system', content: OPTIMIZE_PROMPT },
        { role: 'user', content: message },
      ],
      params.profile,
    );

    const parsed = safeJsonParse(content) as
      | { order?: { tripActivityId: string; startTime: string }[]; explanation?: string }
      | null;

    return {
      order: parsed?.order ?? params.items.map((i) => ({ tripActivityId: i.tripActivityId, startTime: i.startTime ?? '' })),
      explanation: parsed?.explanation ?? 'Ordre inchangé — réponse IA indisponible.',
    };
  }

  // Simplification documented in the guide as acceptable: re-running the
  // full generation under the tightened budget, rather than patching the
  // existing plan incrementally.
  adaptBudget(profile: TripProfile, remaining: number): Promise<Itinerary> {
    return this.generateItinerary({ ...profile, budgetTotal: remaining });
  }

  async chat(profile: TripProfile, context: string, message: string): Promise<{ reply: string }> {
    const systemPrompt =
      'Tu es un assistant de voyage pour le Maroc. Réponds en te basant uniquement sur les outils ' +
      "(searchActivities, searchRestaurants, getDistance, calculateBudget) et sur le contexte du voyage fourni. " +
      "N'invente jamais un prix ou un lieu. Réponds en texte libre, dans la langue du profil, pas en JSON.";

    const { content } = await this.orchestrator.run(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Contexte du voyage : ${context}\n\nMessage : ${message}` },
      ],
      profile,
    );
    return { reply: content || "Désolé, je n'ai pas pu répondre — réessayez." };
  }

  private buildProfileMessage(profile: TripProfile): string {
    const PACE_HINTS: Record<string, string> = {
      relaxed: 'détendu — 2 à 3 activités par jour maximum, marge de repos entre chaque',
      balanced: 'équilibré — 3 à 4 activités par jour',
      intense: 'intense — 5 activités par jour ou plus, journées bien remplies',
    };

    const budgetBreakdown = [
      profile.budgetAccommodation ? `${profile.budgetAccommodation} logement` : null,
      profile.budgetActivities ? `${profile.budgetActivities} activités` : null,
    ].filter(Boolean);

    const cityDurationsText = profile.cityDurations?.length
      ? profile.cityDurations.map((c) => `${c.city} (${c.days}j)`).join(', ')
      : null;

    return (
      `Profil voyageur : ${profile.travelers} voyageur(s)` +
      (profile.travelerType ? ` (${profile.travelerType})` : '') +
      `, ${profile.durationDays ?? '?'} jours, villes : ${profile.cities.join(', ')}. ` +
      (cityDurationsText
        ? `Répartition des jours par ville imposée par le voyageur — respecte-la exactement : ${cityDurationsText}. `
        : '') +
      `Budget total : ${profile.budgetTotal} ${profile.currency}` +
      (budgetBreakdown.length ? ` (dont ${budgetBreakdown.join(', ')})` : '') +
      `. Intérêts : ${profile.interests.join(', ') || 'aucun précisé'}. ` +
      `À éviter : ${profile.avoid.join(', ') || 'rien de précisé'}. ` +
      (profile.comfort ? `Niveau de confort souhaité : ${profile.comfort}. ` : '') +
      (profile.transport ? `Transport local privilégié : ${profile.transport}. ` : '') +
      (profile.intercityTransport && profile.intercityTransport !== 'any'
        ? `Transport inter-villes privilégié : ${profile.intercityTransport} (utilise estimateIntercityTransport). `
        : profile.cities.length > 1
          ? `Transport inter-villes : pas de préférence, choisis l'option la moins chère via estimateIntercityTransport. `
          : '') +
      (profile.pace ? `Rythme souhaité : ${PACE_HINTS[profile.pace] ?? profile.pace}. ` : '') +
      (profile.dietary?.length ? `Contraintes alimentaires : ${profile.dietary.join(', ')}. ` : '') +
      (profile.alreadyInMorocco
        ? `Le voyageur est déjà au Maroc, actuellement à ${profile.currentCity ?? 'une ville non précisée'} — ` +
          'construis à partir de sa situation actuelle plutôt que depuis zéro. '
        : '') +
      (profile.travelNotes ? `Précisions supplémentaires du voyageur : ${profile.travelNotes}. ` : '') +
      `Langue de réponse : ${profile.language}.`
    );
  }

  // Étape F — drop any activityId the model referenced but that no
  // searchActivities/searchRestaurants call actually returned this session.
  private dropUnknownIds(itinerary: Itinerary, dispatcher: { hasSeen(id: string): boolean }): Itinerary {
    const warnings = [...itinerary.warnings];
    const days = itinerary.days.map((day) => ({
      ...day,
      items: day.items.filter((item) => {
        // Transport legs never come from searchActivities/searchRestaurants —
        // dispatcher.hasSeen only tracks catalogue ids, so it never applies here.
        if (item.type === 'transport') return true;
        if (dispatcher.hasSeen(item.activityId)) return true;
        warnings.push(`Activité ignorée (non trouvée dans les résultats de recherche) : ${item.activityId}`);
        return false;
      }),
    }));
    return { ...itinerary, days, warnings };
  }

  // Recomputes cost from the catalogue directly — the LLM's own numbers in
  // the JSON are discarded here, per §2 rule 3 (code is the source of truth).
  private async recomputeBudget(itinerary: Itinerary, profile: TripProfile): Promise<Itinerary> {
    const lines: BudgetLineItem[] = [];
    for (const day of itinerary.days) {
      for (const item of day.items) {
        if (item.type === 'transport') {
          // No catalogue row to recompute from — the LLM only ever reaches
          // this cost through the estimateTransportCost tool (deterministic,
          // see transport-pricing.util.ts), so it is trusted as-is here.
          lines.push({
            tripActivityId: item.activityId,
            category: 'transport',
            day: day.day,
            cost: item.estimatedCost,
            isEstimate: true,
            priceConfidence: null,
            label: item.activityId,
          });
        } else if (item.type === 'activity') {
          const [activity] = await this.activitiesService.findManyByIds([item.activityId]);
          if (!activity) continue;
          const { cost, isEstimate } = this.budgetService.resolveActivityCost({
            isFree: activity.isFree,
            price: activity.price,
            priceRange: activity.priceRange,
            priceConfidence: activity.priceConfidence,
            travelers: profile.travelers,
          });
          lines.push({
            tripActivityId: item.activityId,
            category: 'activities',
            day: day.day,
            cost,
            isEstimate,
            priceConfidence: activity.priceConfidence,
            label: activity.name,
          });
        } else {
          const [restaurant] = await this.restaurantsService.findManyByIds([item.activityId]);
          if (!restaurant) continue;
          const { cost, isEstimate } = this.budgetService.resolveRestaurantCost({
            priceLevel: restaurant.priceLevel,
            avgPricePerPerson: restaurant.avgPricePerPerson,
            travelers: profile.travelers,
          });
          lines.push({
            tripActivityId: item.activityId,
            category: 'food',
            day: day.day,
            cost,
            isEstimate,
            priceConfidence: null,
            label: restaurant.name,
          });
        }
      }
    }

    // Same daily local-transport margin as TripViewService.buildView — kept
    // here too so the draft's preview budget (shown before the traveler ever
    // confirms) already reflects it, not just the post-confirm recompute.
    const days = profile.durationDays ?? itinerary.days.length;
    const dailyMargin = localTransportMargin(profile.transport as TransportMode | null, profile.travelers, 1);
    if (dailyMargin > 0) {
      for (let day = 1; day <= days; day++) {
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

    const result = this.budgetService.calculate(lines, profile.budgetTotal);
    return {
      ...itinerary,
      budget: { total: result.total, estimated: result.estimated, remaining: result.remaining },
      warnings: [...itinerary.warnings, ...result.alerts],
    };
  }
}

function safeJsonParse(content: string): unknown {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
}
