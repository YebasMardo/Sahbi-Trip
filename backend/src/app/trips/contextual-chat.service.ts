import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type OpenAI from 'openai';
import { ActivitiesService } from 'src/app/activities/activities.service';
import { RestaurantsService } from 'src/app/restaurants/restaurants.service';
import { LlmClient } from 'src/app/ai/llm.client';
import { TripViewService } from './trip-view.service';
import { ActivityItemView, DayPlanView } from './trip-view.dto';
import { ChatContextualDto } from './dto/chat-contextual.dto';

// Kept short and last-few-turns-only by the frontend already; capped again
// here so a malformed/oversized client history can't blow up the prompt.
const MAX_HISTORY_TURNS = 6;

const ANTI_HALLUCINATION_RULE =
  "Règle impérative : n'invente jamais un prix, une adresse ou des horaires. " +
  "Si une information demandée n'est pas dans les données ci-dessus, réponds " +
  'que cette information n\'est pas disponible plutôt que de la deviner.';

const DASHBOARD_SYSTEM_PROMPT =
  'Tu es un assistant sympathique qui aide un voyageur à préparer un voyage au Maroc. ' +
  "Explique comment fonctionne l'assistant de création de voyage (le wizard) et le tableau de bord, " +
  "et guide l'utilisateur pour démarrer un nouveau voyage. Tu n'as accès à aucune donnée de voyage " +
  "spécifique dans ce mode — si on te demande un détail sur un voyage précis, dis qu'il faut ouvrir " +
  'ce voyage pour que tu puisses répondre.\n\n' +
  ANTI_HALLUCINATION_RULE;

/**
 * Backend for the floating contextual chat widget. One endpoint, four modes
 * (dashboard/trip/day/activity) — each mode fetches only the real data it
 * needs via the services that already serve the corresponding page, then
 * asks the existing Claude client a single plain-text question. No tools:
 * this is grounded Q&A, not itinerary generation.
 */
@Injectable()
export class ContextualChatService {
  constructor(
    private readonly llmClient: LlmClient,
    private readonly tripViewService: TripViewService,
    private readonly activitiesService: ActivitiesService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async chat(userId: string, dto: ChatContextualDto): Promise<{ reply: string }> {
    const systemPrompt = await this.buildSystemPrompt(userId, dto);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: 'system', content: systemPrompt }];
    for (const turn of (dto.history ?? []).slice(-MAX_HISTORY_TURNS)) {
      if (turn.role === 'assistant') messages.push({ role: 'assistant', content: turn.content });
      else messages.push({ role: 'user', content: turn.content });
    }
    messages.push({ role: 'user', content: dto.message });

    const completion = await this.llmClient.chat(messages);
    const reply = completion.choices[0]?.message?.content?.trim();
    return { reply: reply || "Désolé, je n'ai pas pu répondre — réessayez." };
  }

  private async buildSystemPrompt(userId: string, dto: ChatContextualDto): Promise<string> {
    if (dto.context === 'dashboard') return DASHBOARD_SYSTEM_PROMPT;
    if (dto.context === 'trip') return this.scopedPrompt(await this.tripData(userId, dto.contextId));
    if (dto.context === 'day') return this.scopedPrompt(await this.dayData(userId, dto.contextId));
    return this.scopedPrompt(await this.activityData(userId, dto.contextId));
  }

  private scopedPrompt(data: string): string {
    return (
      'Tu es un assistant de voyage pour le Maroc. Réponds à la question du voyageur en te basant ' +
      `UNIQUEMENT sur les données suivantes :\n\n${data}\n\n` +
      ANTI_HALLUCINATION_RULE
    );
  }

  private async tripData(userId: string, contextId: string | undefined): Promise<string> {
    if (!contextId) throw new BadRequestException('contextId (tripId) requis pour le contexte "trip".');
    const trip = await this.tripViewService.getView(contextId, userId);
    return (
      `Voyage : « ${trip.title} ». Destinations : ${trip.destinationLabel}. Dates : ${trip.dateRangeLabel}. ` +
      `${trip.travelers} voyageur(s). Statut : ${trip.status}. Thèmes : ${trip.themes.join(', ') || 'aucun'}. ` +
      `Nombre de jours planifiés : ${trip.days.length}. ` +
      `Budget total : ${trip.budgetTotalMAD} MAD. Budget estimé actuel : ${trip.budgetEstimatedMAD} MAD. ` +
      `Reste disponible : ${trip.budgetRemainingMAD} MAD.` +
      (trip.budgetAlerts.length ? ` Alertes budget : ${trip.budgetAlerts.join(' ')}` : '')
    );
  }

  private async dayData(userId: string, contextId: string | undefined): Promise<string> {
    const [tripId, dayId] = splitContextId(contextId);
    const trip = await this.tripViewService.getView(tripId, userId);
    const day = trip.days.find((d) => d.id === dayId);
    if (!day) throw new NotFoundException('Jour introuvable pour ce contexte.');

    return (
      `Jour ${day.dayNumber} à ${day.city}, le ${day.date}. Météo prévue : ${day.weatherC}°C, ${day.weatherLabel}. ` +
      `Budget du jour (par personne) : ${dayBudgetLabel(day)}. ` +
      `Programme (${day.activities.length} élément(s)) :\n${day.activities.map(formatItemLine).join('\n') || 'Aucune activité planifiée ce jour-là.'}`
    );
  }

  private async activityData(userId: string, contextId: string | undefined): Promise<string> {
    const [tripId, activityId] = splitContextId(contextId);
    const trip = await this.tripViewService.getView(tripId, userId);
    const item = trip.days.flatMap((d) => d.activities).find((a) => a.id === activityId);
    if (!item) throw new NotFoundException('Activité introuvable pour ce contexte.');

    const base =
      `Lieu : « ${item.name} » (${item.categoryLabel}). Horaire prévu : ${item.startTime}–${item.endTime}. ` +
      `Description : ${item.description || 'non disponible'}. ` +
      `Prix affiché dans l'itinéraire : ${priceLabel(item)}.`;

    if (item.kind === 'activity') {
      const activity = await this.activitiesService.findById(item.refId).catch(() => null);
      if (!activity) return `${base}\nAucune information supplémentaire du catalogue n'est disponible.`;
      return (
        `${base}\n` +
        `Adresse : ${activity.address ?? 'non disponible'}. Horaires d'ouverture : ${activity.openingHours ?? 'non disponible'}. ` +
        `Prix officiel : ${activity.isFree ? 'gratuit' : activity.price != null ? `${activity.price} MAD/pers.` : 'non disponible'} ` +
        `(confiance : ${activity.priceConfidence ?? 'inconnue'}). ` +
        `Réservation obligatoire : ${activity.requiresBooking ? 'oui' : 'non'}. ` +
        `Site web : ${activity.website ?? 'non disponible'}. Téléphone : ${activity.phone ?? 'non disponible'}. ` +
        `Description complète : ${activity.description}. ` +
        `Sources : ${activity.sources.length ? activity.sources.join(', ') : 'aucune'}.`
      );
    }

    if (item.kind === 'restaurant') {
      const restaurant = await this.restaurantsService.findById(item.refId).catch(() => null);
      if (!restaurant) return `${base}\nAucune information supplémentaire du catalogue n'est disponible.`;
      return (
        `${base}\n` +
        `Cuisine : ${restaurant.cuisine}. Adresse : ${restaurant.address ?? 'non disponible'}. ` +
        `Horaires d'ouverture : ${restaurant.openingHours ?? 'non disponible'}. ` +
        `Prix moyen par personne : ${restaurant.avgPricePerPerson != null ? `${restaurant.avgPricePerPerson} MAD` : 'non disponible'}. ` +
        `Site web : ${restaurant.website ?? 'non disponible'}. Téléphone : ${restaurant.phone ?? 'non disponible'}. ` +
        `Description complète : ${restaurant.description}. ` +
        `Sources : ${restaurant.sources.length ? restaurant.sources.join(', ') : 'aucune'}.`
      );
    }

    // Transport legs have no catalogue record — the trip-view item is all there is.
    return `${base}\nCeci est un trajet de transport, sans fiche catalogue associée.`;
  }
}

function splitContextId(contextId: string | undefined): [string, string] {
  const [tripId, secondId] = (contextId ?? '').split(':');
  if (!tripId || !secondId) {
    throw new BadRequestException('contextId invalide pour ce contexte (attendu : "tripId:elementId").');
  }
  return [tripId, secondId];
}

function priceLabel(item: ActivityItemView): string {
  if (item.isFree) return 'gratuit';
  return item.price != null ? `${item.price} MAD/pers.` : 'non disponible';
}

function formatItemLine(item: ActivityItemView): string {
  return `- ${item.startTime}–${item.endTime} : ${item.name} (${item.categoryLabel}), ${priceLabel(item)}`;
}

function dayBudgetLabel(day: DayPlanView): string {
  const total = day.activities.reduce((sum, a) => sum + (a.price ?? 0), 0);
  return `${total} MAD`;
}
