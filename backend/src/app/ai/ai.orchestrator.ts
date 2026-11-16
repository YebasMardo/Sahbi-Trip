import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ActivitiesService } from 'src/app/activities/activities.service';
import { RestaurantsService } from 'src/app/restaurants/restaurants.service';
import { BudgetService } from 'src/app/budget/budget.service';
import { LlmClient } from './llm.client';
import { RetrievalService } from './retrieval.service';
import { ScoringService } from './scoring.service';
import { ToolDispatcher, TOOLS } from './ai.tools';
import { TripProfile } from './schemas';

// Rounds in which the model may call tools. Raised from 6 after observing
// real runs spend 4-6 rounds just gathering candidates for a multi-day trip
// (one searchActivities per city, searchRestaurants, getDistance, then
// calculateBudget) and hit the ceiling before writing the itinerary.
const MAX_TOOL_STEPS = 10;

// Appended when the tool budget is exhausted, so the closing turn is an
// instruction the model can satisfy rather than a silent change of rules.
const FINAL_TURN_NUDGE =
  'Tu as atteint la limite d\'appels d\'outils. Réponds MAINTENANT avec le JSON final ' +
  'demandé, en te basant uniquement sur les résultats déjà obtenus. Aucun texte hors JSON.';

// Agent loop: LLM ⇄ tools, per guide §9. Stops as soon as the model answers
// without requesting a tool call. If it is still calling tools after
// MAX_TOOL_STEPS rounds, one last request is sent *without* tools so the model
// has no choice but to produce its answer — previously this path threw and
// surfaced as a 500, which is the failure mode the guide's "plan B" warns
// about (unstable tool calling) but is recoverable rather than fatal.
@Injectable()
export class AiOrchestrator {
  private readonly logger = new Logger(AiOrchestrator.name);

  constructor(
    private readonly llmClient: LlmClient,
    private readonly activitiesService: ActivitiesService,
    private readonly restaurantsService: RestaurantsService,
    private readonly retrievalService: RetrievalService,
    private readonly scoringService: ScoringService,
    private readonly budgetService: BudgetService,
  ) {}

  async run(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    profile: TripProfile,
  ): Promise<{ content: string; dispatcher: ToolDispatcher }> {
    const dispatcher = new ToolDispatcher(
      this.activitiesService,
      this.restaurantsService,
      this.retrievalService,
      this.scoringService,
      this.budgetService,
      profile,
    );

    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const res = await this.llmClient.chat(messages, TOOLS);
      const msg = res.choices[0].message;

      if (!msg.tool_calls?.length) {
        return { content: msg.content ?? '', dispatcher };
      }

      messages.push(msg);
      for (const call of msg.tool_calls) {
        if (call.type !== 'function') continue;
        let result: unknown;
        try {
          result = await dispatcher.dispatch(call.function.name, JSON.parse(call.function.arguments));
        } catch (error) {
          this.logger.warn(`Tool ${call.function.name} failed: ${(error as Error)?.message}`);
          result = { error: (error as Error)?.message ?? 'Tool call failed' };
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    // Tool budget spent — close the loop with a tool-less turn.
    this.logger.warn(
      `Agent used all ${MAX_TOOL_STEPS} tool rounds; forcing a final answer without tools.`,
    );
    messages.push({ role: 'user', content: FINAL_TURN_NUDGE });
    const finalRes = await this.llmClient.chat(messages);
    return { content: finalRes.choices[0]?.message?.content ?? '', dispatcher };
  }
}
