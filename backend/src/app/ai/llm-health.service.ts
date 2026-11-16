import { Injectable, Logger } from '@nestjs/common';
import { LlmClient } from './llm.client';

export interface ProviderHealth {
  model: string;
  baseUrl: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface AiHealthReport {
  llm: ProviderHealth;
  embed: ProviderHealth;
  rerank: ProviderHealth;
}

/**
 * Liveness of the three provider roles behind the generation pipeline (chat via
 * Anthropic, embeddings and reranking via Voyage AI), for `GET /ai/health` and
 * the dashboard's pipeline panel.
 *
 * Each check is a real round trip — reading config back would only prove the
 * keys are *present*, which is not what the panel claims. The probes are
 * deliberately the smallest request each API accepts (a one-word completion,
 * one short text, three one-character documents) so refreshing the panel stays
 * cheap. The three run concurrently and are individually caught: one provider
 * being down is reported as that provider's failure, never as a failed report.
 */
/**
 * The endpoint is public and the panel refetches on mount and on window focus
 * (see the store's `refetchOnFocus`), so without this every tab switch would
 * spend Anthropic tokens on a liveness probe — competing with real generation
 * for the same rate limit. Short enough that the panel's refresh button
 * still reports fresh state a moment later, long enough to absorb a burst.
 */
const CACHE_TTL_MS = 15_000;

@Injectable()
export class LlmHealthService {
  private readonly logger = new Logger(LlmHealthService.name);
  private cached: { report: AiHealthReport; at: number } | null = null;
  private inFlight: Promise<AiHealthReport> | null = null;

  constructor(private readonly llmClient: LlmClient) {}

  async check(): Promise<AiHealthReport> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.report;
    }
    // Concurrent callers share one probe round rather than each starting their
    // own — several dashboards mounting at once is the common case.
    this.inFlight ??= this.probeAll().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async probeAll(): Promise<AiHealthReport> {
    const [llm, embed, rerank] = await Promise.all([
      this.probe(this.llmClient.chatModel, this.llmClient.chatBaseUrl, async () => {
        const res = await this.llmClient.chat(
          [{ role: 'user', content: 'Réponds uniquement par : ok' }],
          undefined,
          // A one-word answer needs far less than this, but the cap is kept
          // generous because `max_tokens` is a hard ceiling on Anthropic: too
          // tight and a healthy provider gets reported as down for truncating.
          // No waiting out a rate limit or an overload here: this endpoint is
          // public and must answer promptly. "Rate limited" is itself the state
          // the panel should show, not something to stall on hoping it clears.
          { temperature: 0, maxTokens: 256, retryOnRateLimit: false },
        );
        // A 200 carrying no usable text is not a healthy provider, so this is
        // asserted rather than assumed.
        if (!res.choices[0]?.message?.content?.trim()) {
          throw new Error('réponse vide du modèle');
        }
      }),

      this.probe(this.llmClient.embedModel, this.llmClient.voyageBaseUrl, async () => {
        const expected = this.llmClient.embedDimensions;
        const [vector] = await this.llmClient.embed(['ok'], 'query');
        // This width is what the Atlas vector index declares (seed.ts,
        // numDimensions) — a model returning anything else would retrieve
        // nothing, so a wrong width is a failure, not a pass.
        if (vector?.length !== expected) {
          throw new Error(
            `dimensions inattendues : ${vector?.length ?? 0} (${expected} attendu)`,
          );
        }
      }),

      this.probe(this.llmClient.rerankModel, this.llmClient.voyageBaseUrl, async () => {
        const order = await this.llmClient.rerank('ok', ['a', 'b', 'c'], 3);
        if (order.length !== 3) throw new Error(`classement incomplet : ${order.length}/3`);
      }),
    ]);

    const report = { llm, embed, rerank };
    this.cached = { report, at: Date.now() };
    return report;
  }

  private async probe(
    model: string,
    baseUrl: string,
    call: () => Promise<void>,
  ): Promise<ProviderHealth> {
    const startedAt = Date.now();
    try {
      await call();
      return { model, baseUrl, ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const message = (error as Error)?.message ?? 'erreur inconnue';
      this.logger.warn(`Health check failed for ${model}: ${message}`);
      return {
        model,
        baseUrl,
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: message,
      };
    }
  }
}
