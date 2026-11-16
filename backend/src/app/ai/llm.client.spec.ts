import { HttpStatus } from '@nestjs/common';
import type OpenAI from 'openai';
import { LlmClient } from './llm.client';

// The whole risk of the Anthropic migration sits in one place: LlmClient
// translates between the OpenAI shape the rest of the ai module speaks and
// Anthropic's structurally different Messages API. `npm run verify:ai` proves
// that against the live providers, but it needs real keys and burns quota —
// these tests pin the translation itself by stubbing `fetch`, so a regression
// in the shape is caught without a network call.

interface CapturedRequest {
  url: string;
  headers: Record<string, string>;
  body: any;
}

function stubFetch(responses: unknown[]): { captured: CapturedRequest[]; restore: () => void } {
  const captured: CapturedRequest[] = [];
  const queue = [...responses];
  const original = globalThis.fetch;

  globalThis.fetch = (async (url: string, init: RequestInit) => {
    captured.push({
      url: String(url),
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string),
    });
    const next = queue.shift();
    if (next instanceof Response) return next;
    return new Response(JSON.stringify(next), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof globalThis.fetch;

  return { captured, restore: () => void (globalThis.fetch = original) };
}

function buildClient(): LlmClient {
  const values: Record<string, string | number> = {
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    ANTHROPIC_MODEL: 'claude-haiku-4-5',
    VOYAGE_API_KEY: 'test-voyage-key',
    VOYAGE_EMBED_MODEL: 'voyage-4',
    VOYAGE_RERANK_MODEL: 'rerank-3',
    AI_TIMEOUT_MS: 5_000,
  };
  return new LlmClient({ get: (key: string) => values[key] } as never);
}

const TEXT_RESPONSE = {
  id: 'msg_01',
  model: 'claude-haiku-4-5',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: 'ok' }],
  usage: { input_tokens: 11, output_tokens: 2 },
};

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'searchActivities',
      description: 'Recherche des activités.',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  },
];

describe('LlmClient — Anthropic request translation', () => {
  let stub: ReturnType<typeof stubFetch>;

  afterEach(() => stub?.restore());

  it('lifts the system message out of `messages` into the top-level field', async () => {
    stub = stubFetch([TEXT_RESPONSE]);
    await buildClient().chat([
      { role: 'system', content: 'Tu es un assistant.' },
      { role: 'user', content: 'Bonjour' },
    ]);

    const { body, url, headers } = stub.captured[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    // Anthropic authenticates on x-api-key, not Authorization: Bearer, and
    // rejects a system-role entry inside `messages`.
    expect(headers['x-api-key']).toBe('test-anthropic-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(body.system).toBe('Tu es un assistant.');
    expect(body.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Bonjour' }] }]);
    expect(body.messages.some((m: any) => m.role === 'system')).toBe(false);
    // Required by Anthropic even when the caller passes no option.
    expect(body.max_tokens).toBe(8192);
  });

  it('translates the project TOOLS into Anthropic {name, description, input_schema}', async () => {
    stub = stubFetch([TEXT_RESPONSE]);
    await buildClient().chat([{ role: 'user', content: 'Salut' }], TOOLS);

    // The single source of truth stays ai.tools.ts — only the wrapper changes.
    expect(stub.captured[0].body.tools).toEqual([
      {
        name: 'searchActivities',
        description: 'Recherche des activités.',
        input_schema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      },
    ]);
    expect(stub.captured[0].body.tools[0]).not.toHaveProperty('function');
  });

  it('replays an assistant tool_calls turn and its tool results as Anthropic blocks', async () => {
    stub = stubFetch([TEXT_RESPONSE]);
    await buildClient().chat(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'Marrakech ?' },
        {
          role: 'assistant',
          content: null,
          refusal: null,
          tool_calls: [
            {
              id: 'toolu_1',
              type: 'function',
              function: { name: 'searchActivities', arguments: '{"city":"Marrakech"}' },
            },
            {
              id: 'toolu_2',
              type: 'function',
              function: { name: 'searchRestaurants', arguments: '{"city":"Marrakech"}' },
            },
          ],
        },
        { role: 'tool', tool_call_id: 'toolu_1', content: '[{"refId":"a"}]' },
        { role: 'tool', tool_call_id: 'toolu_2', content: '[{"refId":"b"}]' },
      ],
      TOOLS,
    );

    const { messages } = stub.captured[0].body;
    expect(messages[1]).toEqual({
      role: 'assistant',
      content: [
        // `arguments` is a JSON string on the OpenAI side; Anthropic wants the
        // parsed object under `input`.
        { type: 'tool_use', id: 'toolu_1', name: 'searchActivities', input: { city: 'Marrakech' } },
        { type: 'tool_use', id: 'toolu_2', name: 'searchRestaurants', input: { city: 'Marrakech' } },
      ],
    });
    // Both results must arrive in ONE user turn — the orchestrator emits one
    // `role: 'tool'` message per call, Anthropic expects them grouped.
    expect(messages).toHaveLength(3);
    expect(messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_1', content: '[{"refId":"a"}]' },
        { type: 'tool_result', tool_use_id: 'toolu_2', content: '[{"refId":"b"}]' },
      ],
    });
  });

  it("keeps a tool history valid on the orchestrator's tool-less closing turn", async () => {
    stub = stubFetch([TEXT_RESPONSE]);
    // ai.orchestrator.ts calls chat(messages) with no tools to force a text
    // answer. Anthropic rejects a history referencing tools that are no longer
    // declared, so they are re-declared as stubs and forbidden outright.
    await buildClient().chat([
      { role: 'user', content: 'Marrakech ?' },
      {
        role: 'assistant',
        content: null,
        refusal: null,
        tool_calls: [
          {
            id: 'toolu_1',
            type: 'function',
            function: { name: 'searchActivities', arguments: '{}' },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'toolu_1', content: '[]' },
      { role: 'user', content: 'Réponds maintenant.' },
    ]);

    const { body } = stub.captured[0];
    expect(body.tools).toEqual([{ name: 'searchActivities', input_schema: { type: 'object' } }]);
    expect(body.tool_choice).toEqual({ type: 'none' });
  });

  it('passes temperature and maxTokens through, and omits tool_choice when tools are given', async () => {
    stub = stubFetch([TEXT_RESPONSE]);
    await buildClient().chat([{ role: 'user', content: 'x' }], TOOLS, {
      temperature: 0.1,
      maxTokens: 1024,
    });

    expect(stub.captured[0].body.temperature).toBe(0.1);
    expect(stub.captured[0].body.max_tokens).toBe(1024);
    expect(stub.captured[0].body).not.toHaveProperty('tool_choice');
  });
});

describe('LlmClient — Anthropic response translation', () => {
  let stub: ReturnType<typeof stubFetch>;

  afterEach(() => stub?.restore());

  it('maps a text answer onto choices[0].message.content with finish_reason "stop"', async () => {
    stub = stubFetch([TEXT_RESPONSE]);
    const res = await buildClient().chat([{ role: 'user', content: 'x' }]);

    expect(res.object).toBe('chat.completion');
    expect(res.model).toBe('claude-haiku-4-5');
    expect(res.choices[0].finish_reason).toBe('stop');
    expect(res.choices[0].message.content).toBe('ok');
    expect(res.choices[0].message.tool_calls).toBeUndefined();
    expect(res.usage).toEqual({ prompt_tokens: 11, completion_tokens: 2, total_tokens: 13 });
  });

  it('surfaces EVERY parallel tool_use block as a parseable tool_calls entry', async () => {
    // Verified in manual testing: one Haiku turn can return two tool_use
    // blocks for two intents in one query. Exposing only the first would
    // silently lose half the tool work in the agent loop.
    stub = stubFetch([
      {
        id: 'msg_02',
        model: 'claude-haiku-4-5',
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Je cherche.' },
          {
            type: 'tool_use',
            id: 'toolu_a',
            name: 'searchActivities',
            input: { city: 'Marrakech', query: 'culture' },
          },
          {
            type: 'tool_use',
            id: 'toolu_b',
            name: 'searchRestaurants',
            input: { city: 'Marrakech' },
          },
        ],
        usage: { input_tokens: 40, output_tokens: 30 },
      },
    ]);

    const res = await buildClient().chat([{ role: 'user', content: 'x' }], TOOLS);
    const message = res.choices[0].message;

    expect(res.choices[0].finish_reason).toBe('tool_calls');
    expect(message.content).toBe('Je cherche.');
    expect(message.tool_calls).toHaveLength(2);

    for (const call of message.tool_calls!) {
      expect(call.type).toBe('function');
      // ai.orchestrator.ts does JSON.parse on this field — it must be a
      // string, not the object Anthropic returned.
      expect(typeof (call as any).function.arguments).toBe('string');
    }
    expect(JSON.parse((message.tool_calls![0] as any).function.arguments)).toEqual({
      city: 'Marrakech',
      query: 'culture',
    });
    expect((message.tool_calls![1] as any).function.name).toBe('searchRestaurants');
  });

  it('reports content as null when the turn carries only tool_use blocks', async () => {
    stub = stubFetch([
      {
        id: 'msg_03',
        model: 'claude-haiku-4-5',
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'toolu_c', name: 'searchActivities', input: {} }],
      },
    ]);
    const res = await buildClient().chat([{ role: 'user', content: 'x' }], TOOLS);
    expect(res.choices[0].message.content).toBeNull();
  });

  it('maps max_tokens truncation onto finish_reason "length"', async () => {
    stub = stubFetch([
      {
        id: 'msg_04',
        model: 'claude-haiku-4-5',
        stop_reason: 'max_tokens',
        content: [{ type: 'text', text: '{"partial":' }],
      },
    ]);
    const res = await buildClient().chat([{ role: 'user', content: 'x' }]);
    expect(res.choices[0].finish_reason).toBe('length');
  });
});

describe('LlmClient — transient error handling', () => {
  let stub: ReturnType<typeof stubFetch>;

  afterEach(() => stub?.restore());

  const errorResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  it('retries a 429 and succeeds on the next attempt', async () => {
    stub = stubFetch([
      errorResponse(429, { error: { type: 'rate_limit_error' } }, { 'retry-after': '0' }),
      TEXT_RESPONSE,
    ]);
    vi.useFakeTimers();
    try {
      const pending = buildClient().chat([{ role: 'user', content: 'x' }]);
      await vi.advanceTimersByTimeAsync(5_000);
      const res = await pending;
      expect(stub.captured).toHaveLength(2);
      expect(res.choices[0].message.content).toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  // The next two exercise the full backoff ladder (2s + 5s + 10s). Fake timers
  // keep them instant instead of making the suite sleep 17 real seconds.
  it('retries a 529 overloaded_error — the provider-wide saturation case', async () => {
    stub = stubFetch([
      errorResponse(529, { error: { type: 'overloaded_error' } }),
      errorResponse(529, { error: { type: 'overloaded_error' } }),
      TEXT_RESPONSE,
    ]);
    vi.useFakeTimers();
    try {
      const pending = buildClient().chat([{ role: 'user', content: 'x' }]);
      await vi.advanceTimersByTimeAsync(20_000);
      const res = await pending;
      expect(stub.captured).toHaveLength(3);
      expect(res.choices[0].message.content).toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up after the backoff ladder and surfaces a 429', async () => {
    stub = stubFetch(
      Array.from({ length: 4 }, () =>
        // `retry-after: 0` is honoured as a *floor* against the ladder, not as
        // licence to hot-loop: the ladder still paces the three retries.
        errorResponse(429, { error: { type: 'rate_limit_error' } }, { 'retry-after': '0' }),
      ),
    );
    vi.useFakeTimers();
    try {
      const pending = buildClient().chat([{ role: 'user', content: 'x' }]);
      const assertion = expect(pending).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
      await vi.advanceTimersByTimeAsync(20_000);
      await assertion;
      // 1 initial attempt + 3 ladder steps.
      expect(stub.captured).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not wait out a rate limit when retryOnRateLimit is false (health probe)', async () => {
    stub = stubFetch([
      errorResponse(429, { error: { type: 'rate_limit_error' } }, { 'retry-after': '30' }),
    ]);
    await expect(
      buildClient().chat([{ role: 'user', content: 'x' }], undefined, {
        retryOnRateLimit: false,
      }),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(stub.captured).toHaveLength(1);
  });

  it('fails immediately on a retry-after longer than the per-minute window', async () => {
    // A long hint is a spend cap or daily quota, not the window this retry
    // exists for — waiting it out would not clear it.
    stub = stubFetch([
      errorResponse(429, { error: { type: 'rate_limit_error' } }, { 'retry-after': '1800' }),
    ]);
    await expect(buildClient().chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(stub.captured).toHaveLength(1);
  });

  it('never retries a 401 and reports it as unavailable, not as a client error', async () => {
    stub = stubFetch([errorResponse(401, { error: { type: 'authentication_error' } })]);
    await expect(buildClient().chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(stub.captured).toHaveLength(1);
  });
});

describe('LlmClient — Voyage embed/rerank', () => {
  let stub: ReturnType<typeof stubFetch>;

  afterEach(() => stub?.restore());

  it('requests 1024-dim document vectors for "passage" and keeps input order', async () => {
    stub = stubFetch([
      {
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] },
        ],
      },
    ]);
    const vectors = await buildClient().embed(['un', 'deux'], 'passage');

    const { url, headers, body } = stub.captured[0];
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    expect(headers.Authorization).toBe('Bearer test-voyage-key');
    expect(body).toEqual({
      model: 'voyage-4',
      input: ['un', 'deux'],
      // Must stay 'document' — that is what seed.ts wrote into `embedding`.
      input_type: 'document',
      // Must stay 1024 — the Atlas index's numDimensions.
      output_dimension: 1024,
    });
    // Sorted back by `index`, so vector i still belongs to text i.
    expect(vectors).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('maps "query" to Voyage\'s query input type', async () => {
    stub = stubFetch([{ data: [{ index: 0, embedding: [1] }] }]);
    await buildClient().embed(['q'], 'query');
    expect(stub.captured[0].body.input_type).toBe('query');
  });

  it('sends top_k (not top_n) and returns indices ordered by relevance', async () => {
    stub = stubFetch([
      {
        data: [
          { index: 0, relevance_score: 0.2 },
          { index: 1, relevance_score: 0.9 },
          { index: 2, relevance_score: 0.5 },
        ],
      },
    ]);
    const order = await buildClient().rerank('q', ['a', 'b', 'c'], 3);

    const { url, body } = stub.captured[0];
    expect(url).toBe('https://api.voyageai.com/v1/rerank');
    // Voyage spells it top_k; Cohere used top_n. Pure body-field rename.
    expect(body).toEqual({ model: 'rerank-3', query: 'q', documents: ['a', 'b', 'c'], top_k: 3 });
    expect(body).not.toHaveProperty('top_n');
    expect(order).toEqual([1, 2, 0]);
  });

  it('short-circuits without a request on empty input', async () => {
    stub = stubFetch([]);
    expect(await buildClient().embed([], 'query')).toEqual([]);
    expect(await buildClient().rerank('q', [])).toEqual([]);
    expect(stub.captured).toHaveLength(0);
  });

  it('does not retry Voyage failures — retrieval degrades gracefully upstream', async () => {
    stub = stubFetch([new Response('rate limited', { status: 429 })]);
    await expect(buildClient().embed(['x'], 'query')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(stub.captured).toHaveLength(1);
  });
});
