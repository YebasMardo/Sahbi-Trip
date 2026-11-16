import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Type-only import: the `openai` package is kept as the *vocabulary* the rest
// of the module already speaks (ai.orchestrator.ts and ai.tools.ts are typed
// against it), but none of its runtime client is loaded — it is the wrong
// client for Anthropic's Messages API, which is not OpenAI-compatible.
import type OpenAI from 'openai';
import { AppConfig } from 'src/core/config';

// Neither provider is OpenAI-compatible, so both are called over plain fetch.
// Neither URL is configurable: there is no self-hosted variant of either API
// to point at, and `anthropic-version` is a wire-format pin rather than a
// deployment knob.
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const VOYAGE_BASE_URL = 'https://api.voyageai.com/v1';

/**
 * Must stay 1024: this is the `numDimensions` declared by the Atlas vector
 * index (`scripts/seed.ts`) and the width of every `embedding` already stored
 * in the activities collection. Voyage defaults to a wider vector, so the
 * dimension is pinned explicitly on every request — a mismatch would make
 * `$vectorSearch` return nothing rather than fail loudly.
 */
const EMBED_DIMENSIONS = 1024;

/**
 * Both providers distinguish the two sides of a semantic search: documents
 * indexed ahead of time and the query asked against them are embedded with
 * different `input_type` values, and mixing them degrades similarity.
 * `'passage'` must stay Voyage's `document` — that is what `scripts/seed.ts`
 * wrote into the `embedding` field, and a query embedded any other way would
 * not match it.
 */
export type EmbedInputType = 'query' | 'passage';

const VOYAGE_INPUT_TYPE: Record<EmbedInputType, string> = {
  query: 'query',
  passage: 'document',
};

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /**
   * Set false to surface a rate limit or an overload immediately instead of
   * waiting it out. For a liveness probe the 429/529 *is* the answer worth
   * reporting — waiting would turn a health check into a long hang.
   */
  retryOnRateLimit?: boolean;
}

/**
 * Anthropic has two distinct transient failures and they mean different
 * things. 429 `rate_limit_error` is *our* account hitting a limit — it clears
 * on its own and the response says when. 529 `overloaded_error` is Anthropic's
 * infrastructure being saturated for everyone, which no amount of politeness
 * on our side fixes but which is usually brief.
 *
 * Both are worth waiting out rather than surfacing, because the agent loop
 * resends a growing conversation every round: a failure on round 6 of 10
 * throws away five rounds of real tool work. Bounded deliberately — three
 * backoff steps, so a genuinely exhausted quota still fails fast.
 *
 * There is no secondary model to fall back to on 529: this project runs
 * Haiku only, by decision, so the retry ladder is the whole strategy.
 */
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

/**
 * A `retry-after` longer than this is not the per-minute window this retry
 * exists for — it is a spend cap or a daily quota, which waiting will not
 * clear. Failing immediately gives the caller a truthful 429 now instead of
 * after three useless pauses.
 */
const MAX_RATE_LIMIT_WAIT_MS = 65_000;

/**
 * Generous by default: a full multi-day itinerary JSON is long, and a
 * truncated response fails schema validation and burns a retry.
 */
const DEFAULT_MAX_TOKENS = 8192;

/** Anthropic `stop_reason` → the `finish_reason` the OpenAI shape declares. */
const FINISH_REASONS: Record<string, OpenAI.Chat.ChatCompletion.Choice['finish_reason']> = {
  tool_use: 'tool_calls',
  end_turn: 'stop',
  stop_sequence: 'stop',
  pause_turn: 'stop',
  max_tokens: 'length',
  refusal: 'content_filter',
};

/** Raw provider failure, before it is mapped onto a client-facing status. */
class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly headers?: Headers,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// --- Anthropic wire shapes (only the fields this adapter reads/writes) ------

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}
interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContentBlock[];
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicRequest {
  system?: string;
  messages: AnthropicMessage[];
  tools: AnthropicTool[];
  toolChoice?: { type: 'none' };
}

interface AnthropicResponse {
  id?: string;
  model?: string;
  stop_reason?: string | null;
  content?: { type?: string; text?: string; id?: string; name?: string; input?: unknown }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Single door to the two AI providers: Anthropic Claude for chat + tool
 * calling, Voyage AI for embeddings and reranking.
 *
 * Nothing above this class knows which vendor answers — callers get an
 * OpenAI-shaped completion, a `number[][]` of vectors, or an array of
 * candidate indices. Anthropic's Messages API is structurally different from
 * that shape (separate top-level `system`, a `content` array of blocks instead
 * of `choices`, already-parsed tool inputs), so the translation both ways is
 * contained here and `ai.service.ts` / `ai.orchestrator.ts` are untouched.
 *
 * Provider failures are normalised into typed HttpExceptions (see
 * `translateProviderError`) so a rate limit surfaces as 429 and an outage as
 * 503, instead of leaking a vendor error as a 500.
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly timeoutMs: number;

  readonly chatModel: string;
  readonly chatBaseUrl = ANTHROPIC_BASE_URL;
  readonly embedModel: string;
  readonly rerankModel: string;
  readonly voyageBaseUrl = VOYAGE_BASE_URL;
  readonly embedDimensions = EMBED_DIMENSIONS;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    this.chatModel = this.configService.get('ANTHROPIC_MODEL');
    this.embedModel = this.configService.get('VOYAGE_EMBED_MODEL');
    this.rerankModel = this.configService.get('VOYAGE_RERANK_MODEL');
    this.timeoutMs = this.configService.get('AI_TIMEOUT_MS');
  }

  /**
   * One chat round. `tools` is passed straight through, so the caller decides
   * whether the model may request a tool call — the orchestrator's final turn
   * deliberately omits it to force a text answer.
   */
  async chat(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools?: OpenAI.Chat.ChatCompletionTool[],
    options?: ChatOptions,
  ): Promise<OpenAI.Chat.ChatCompletion> {
    const request = toAnthropicRequest(messages, tools);
    const payload = {
      model: this.chatModel,
      // Required by Anthropic, unlike OpenAI where it is optional.
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: request.messages,
      ...(request.system ? { system: request.system } : {}),
      ...(request.tools.length ? { tools: request.tools } : {}),
      ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
      // Still accepted on Haiku 4.5 (sampling parameters were only removed on
      // the 4.7+ generation), so the callers' low-temperature JSON extraction
      // keeps working unchanged.
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    };

    for (let attempt = 0; ; attempt++) {
      try {
        const body = await this.anthropic<AnthropicResponse>('/messages', payload);
        return fromAnthropicResponse(body, this.chatModel);
      } catch (error) {
        const waitMs =
          options?.retryOnRateLimit === false ? null : transientRetryWaitMs(error, attempt);
        if (waitMs === null) throw this.translateProviderError(error, 'Anthropic (messages)');
        const kind = (error as ProviderError).status === 529 ? 'overloaded' : 'rate limit';
        this.logger.warn(
          `Anthropic ${kind}; waiting ${waitMs}ms before retry ${attempt + 1}/${RETRY_DELAYS_MS.length}.`,
        );
        await sleep(waitMs);
      }
    }
  }

  /** Embeds `texts` into 1024-dim vectors matching the Atlas vector index. */
  async embed(texts: string[], inputType: EmbedInputType): Promise<number[][]> {
    if (!texts.length) return [];
    const body = await this.voyage<{ data?: { index?: number; embedding: number[] }[] }>(
      '/embeddings',
      {
        model: this.embedModel,
        input: texts,
        input_type: VOYAGE_INPUT_TYPE[inputType],
        output_dimension: EMBED_DIMENSIONS,
      },
    );
    const rows = body.data ?? [];
    if (!rows.length) {
      throw new HttpException(
        "Le service d'embeddings a renvoyé une réponse vide.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    // Voyage tags each row with its position in `input`; sorting on it keeps
    // vector i aligned with text i even if the response arrives out of order.
    return [...rows]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((row) => row.embedding);
  }

  /**
   * Reranks `documents` against `query`, returning their **original indices**
   * ordered best-first — callers map those back onto their own candidate
   * array, so no document text has to survive the round trip.
   */
  async rerank(query: string, documents: string[], topN?: number): Promise<number[]> {
    if (!documents.length) return [];
    const body = await this.voyage<{ data?: { index: number; relevance_score: number }[] }>(
      '/rerank',
      {
        model: this.rerankModel,
        query,
        documents,
        // Voyage spells this `top_k`, not `top_n` — same meaning, and the
        // external `topN` argument of this method is unchanged.
        top_k: Math.min(topN ?? documents.length, documents.length),
      },
    );
    return [...(body.data ?? [])]
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map((result) => result.index);
  }

  /**
   * Leaves the raw `ProviderError` intact so `chat` can read the status and
   * decide whether the failure is worth waiting out.
   */
  private anthropic<T>(path: string, payload: unknown): Promise<T> {
    return this.postJson<T>(`${ANTHROPIC_BASE_URL}${path}`, payload, {
      // Anthropic authenticates on its own header, not `Authorization: Bearer`.
      'x-api-key': this.configService.get('ANTHROPIC_API_KEY'),
      'anthropic-version': ANTHROPIC_VERSION,
    });
  }

  private async voyage<T>(path: string, payload: unknown): Promise<T> {
    try {
      return await this.postJson<T>(`${VOYAGE_BASE_URL}${path}`, payload, {
        Authorization: `Bearer ${this.configService.get('VOYAGE_API_KEY')}`,
      });
    } catch (error) {
      // No retry ladder here: embed/rerank both have a graceful degradation
      // path upstream (RetrievalService falls back to a plain city query and
      // to retrieval order), so failing fast is better than stalling.
      throw this.translateProviderError(error, `Voyage (${path})`);
    }
  }

  private async postJson<T>(
    url: string,
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      // Network-level failure (DNS, TLS, abort) — never reached the provider.
      throw new ProviderError((error as Error)?.message ?? 'network error');
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new ProviderError(detail.slice(0, 300) || res.statusText, res.status, res.headers);
    }
    return (await res.json()) as T;
  }

  /**
   * Maps a provider failure onto the status the client should actually see.
   * A 429 is the provider's, not the caller's, but it is still the honest
   * answer: retrying immediately makes it worse. Anything else that is not a
   * caller mistake becomes 503 — the pipeline is temporarily unavailable,
   * which is true, rather than 500, which would claim a bug in our code.
   */
  private translateProviderError(error: unknown, provider: string): HttpException {
    if (error instanceof HttpException) return error;

    const status = (error as { status?: number })?.status;
    const message = (error as Error)?.message ?? 'unknown error';
    this.logger.error(`${provider} failed${status ? ` (${status})` : ''}: ${message}`);

    // Anthropic reports an exhausted prepaid balance as a 400, not a 429 —
    // it is a quota wall either way, and telling the user to "retry shortly"
    // would just make them retry into it.
    const isHardQuota = /credit balance|per day|quota|TPD|RPD/i.test(message);
    if (status === 400 && isHardQuota) {
      return new HttpException(
        'Le quota IA est épuisé. La génération repartira après sa réinitialisation.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (status === 429) {
      return new HttpException(
        isHardQuota
          ? 'Le quota IA quotidien est épuisé. La génération repartira après la réinitialisation du quota.'
          : 'Le service IA est momentanément saturé. Réessayez dans quelques instants.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (status === 529) {
      // Not our account's limit — the provider's own capacity. Nothing the
      // caller can do differently, so this is an availability answer, not a
      // "you asked too much" one.
      return new HttpException(
        "Le fournisseur IA est surchargé. Réessayez dans quelques instants.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (status === 401 || status === 403) {
      // A bad key is ours to fix, not the user's to retry — but it must not
      // look like a client error to the caller either.
      return new HttpException(
        "Le service IA a refusé l'authentification.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return new HttpException(
      "Le service IA est indisponible pour le moment.",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * How long to wait before retrying, or `null` if this error must not be
 * retried. Prefers Anthropic's own `retry-after` hint over the ladder when it
 * is present and plausible, since it knows when the window actually rolls
 * over; the ladder stays the floor so a `retry-after: 1` cannot turn three
 * retries into a hot loop.
 *
 * Note for any future streaming caller: a 529 on an already-open stream does
 * not arrive as an HTTP status at all — it comes back as an `error` event
 * inside a 200 response, so `res.status` will not see it. Nothing in this
 * module streams today, so that path is deliberately absent rather than
 * written untested.
 */
function transientRetryWaitMs(error: unknown, attempt: number): number | null {
  const err = error as ProviderError;
  if (err?.status !== 429 && err?.status !== 529) return null;
  if (attempt >= RETRY_DELAYS_MS.length) return null;

  const backoffMs = RETRY_DELAYS_MS[attempt];
  if (err.status === 429) {
    // Only a 429 carries an account-specific window worth honouring; a 529 is
    // capacity-wide and its wait is not knowable from the response.
    const seconds = Number(err.headers?.get('retry-after'));
    if (Number.isFinite(seconds) && seconds > 0) {
      const hintedMs = seconds * 1000 + 250; // +250ms to resume just past the rollover
      return hintedMs > MAX_RATE_LIMIT_WAIT_MS ? null : Math.max(hintedMs, backoffMs);
    }
  }
  return backoffMs;
}

/**
 * OpenAI-shaped conversation → Anthropic Messages request.
 *
 * Three structural differences have to be absorbed here, because the
 * orchestrator pushes its own OpenAI-shaped turns back into the same array it
 * hands to `chat()`:
 *
 * 1. `system` is a top-level request field on Anthropic, and a system-role
 *    entry inside `messages` is rejected — so it is lifted out.
 * 2. An assistant turn's `tool_calls` become `tool_use` content blocks, with
 *    the JSON-string `arguments` parsed back into the object Anthropic wants.
 * 3. `role: 'tool'` does not exist. Each result becomes a `tool_result` block,
 *    and consecutive ones are merged into a **single** user turn — Anthropic
 *    expects all results for one assistant turn together, while the
 *    orchestrator emits one message per call.
 */
function toAnthropicRequest(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  tools?: OpenAI.Chat.ChatCompletionTool[],
): AnthropicRequest {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];
  let pendingToolResults: AnthropicToolResultBlock[] = [];

  const flushToolResults = () => {
    if (!pendingToolResults.length) return;
    out.push({ role: 'user', content: pendingToolResults });
    pendingToolResults = [];
  };

  for (const message of messages) {
    if (message.role === 'system' || message.role === 'developer') {
      const text = textOf(message.content);
      if (text) systemParts.push(text);
      continue;
    }

    if (message.role === 'tool') {
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: message.tool_call_id,
        content: textOf(message.content),
      });
      continue;
    }

    flushToolResults();

    if (message.role === 'assistant') {
      const blocks: AnthropicContentBlock[] = [];
      const text = textOf(message.content);
      if (text) blocks.push({ type: 'text', text });
      for (const call of message.tool_calls ?? []) {
        if (call.type !== 'function') continue;
        blocks.push({
          type: 'tool_use',
          id: call.id,
          name: call.function.name,
          // Anthropic wants the already-parsed object here; this is the exact
          // inverse of the re-serialisation done in `fromAnthropicResponse`.
          input: safeJsonObject(call.function.arguments),
        });
      }
      // An assistant turn with neither text nor tool calls has nothing to
      // replay, and an empty content array is rejected.
      if (blocks.length) out.push({ role: 'assistant', content: blocks });
      continue;
    }

    if (message.role === 'user') {
      const text = textOf(message.content);
      if (text) out.push({ role: 'user', content: [{ type: 'text', text }] });
    }
    // `role: 'function'` is OpenAI's pre-`tool_calls` legacy shape; nothing in
    // this module produces it.
  }

  flushToolResults();

  const declared = (tools ?? []).flatMap((tool) =>
    tool.type === 'function'
      ? [
          {
            name: tool.function.name,
            ...(tool.function.description ? { description: tool.function.description } : {}),
            input_schema: (tool.function.parameters ?? { type: 'object' }) as Record<
              string,
              unknown
            >,
          },
        ]
      : [],
  );

  const request: AnthropicRequest = {
    ...(systemParts.length ? { system: systemParts.join('\n\n') } : {}),
    messages: out,
    tools: declared,
  };

  // The orchestrator's closing turn calls `chat(messages)` with no tools on a
  // history that already contains tool_use/tool_result blocks, to force a text
  // answer. Anthropic rejects that history unless the referenced tools are
  // still declared — so they are re-declared as bare stubs and forbidden via
  // `tool_choice: none`, which expresses the caller's intent exactly.
  if (!declared.length) {
    const usedNames = [
      ...new Set(
        out.flatMap((message) =>
          message.content.flatMap((block) => (block.type === 'tool_use' ? [block.name] : [])),
        ),
      ),
    ];
    if (usedNames.length) {
      request.tools = usedNames.map((name) => ({ name, input_schema: { type: 'object' } }));
      request.toolChoice = { type: 'none' };
    }
  }

  return request;
}

/**
 * Anthropic Messages response → the exact OpenAI shape the orchestrator and
 * the two JSON-extracting services already consume. Every `tool_use` block is
 * surfaced, not just the first: a single Claude turn routinely returns several
 * in parallel (e.g. an activity search and a restaurant search for the same
 * query), and dropping the rest would silently lose half the tool work.
 */
function fromAnthropicResponse(
  body: AnthropicResponse,
  requestedModel: string,
): OpenAI.Chat.ChatCompletion {
  const texts: string[] = [];
  const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];

  for (const block of body.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      texts.push(block.text);
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id ?? '',
        type: 'function',
        function: {
          name: block.name ?? '',
          // Re-serialised because the orchestrator does `JSON.parse` on this
          // field; Anthropic hands the input over already parsed.
          arguments: JSON.stringify(block.input ?? {}),
        },
      });
    }
    // `thinking` / `redacted_thinking` blocks are not requested (no `thinking`
    // parameter is sent) and carry nothing a caller here reads.
  }

  const joined = texts.join('');

  return {
    id: body.id ?? '',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model ?? requestedModel,
    choices: [
      {
        index: 0,
        logprobs: null,
        finish_reason: FINISH_REASONS[body.stop_reason ?? ''] ?? 'stop',
        message: {
          role: 'assistant',
          content: joined.length ? joined : null,
          refusal: null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
      },
    ],
    usage: {
      prompt_tokens: body.usage?.input_tokens ?? 0,
      completion_tokens: body.usage?.output_tokens ?? 0,
      total_tokens: (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0),
    },
  };
}

/**
 * Flattens the several shapes OpenAI allows for `content` into the plain text
 * Anthropic blocks need. Every caller in this module passes a string; the
 * array branch exists so a future multi-part message degrades to its text
 * instead of stringifying an object into the prompt.
 */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) =>
      part && typeof part === 'object' && 'text' in part && typeof part.text === 'string'
        ? part.text
        : '',
    )
    .join('');
}

/**
 * A malformed `arguments` string is the model's mistake, not a reason to fail
 * the whole turn: an empty object still round-trips, and the tool dispatcher
 * already reports its own argument errors back to the model as tool results.
 */
function safeJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
