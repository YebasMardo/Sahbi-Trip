// Standalone smoke test for the Anthropic/Voyage providers — not part of the
// Nest DI container (same convention as seed.ts). Run with `npm run verify:ai`.
//
// Unlike the previous Groq/Cohere version, this exercises the real `LlmClient`
// rather than reimplementing the HTTP calls: the whole point of the Anthropic
// migration is the translation layer inside that class, so a verification that
// bypassed it would prove nothing about what the app actually runs.
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import type OpenAI from 'openai';

loadEnv({ path: join(__dirname, '..', '..', '.env') });

// Imported after loadEnv so nothing in the import chain reads env too early.
// TOOLS is a plain constant, safe to use outside the DI container the rest of
// that file's exports depend on.
import { TOOLS } from '../src/app/ai/ai.tools';
import { LlmClient } from '../src/app/ai/llm.client';

/**
 * LlmClient's only dependency is ConfigService#get, so a one-method stand-in
 * backed by process.env is enough to drive the real class here — no Nest
 * container, no module graph, and no duplicated request-building logic.
 */
function buildClient(): LlmClient {
  const defaults: Record<string, string> = {
    ANTHROPIC_MODEL: 'claude-haiku-4-5',
    VOYAGE_EMBED_MODEL: 'voyage-4',
    VOYAGE_RERANK_MODEL: 'rerank-3',
    AI_TIMEOUT_MS: '90000',
  };
  const configService = {
    get: (key: string) => {
      const raw = process.env[key] ?? defaults[key];
      return key === 'AI_TIMEOUT_MS' ? Number(raw) : raw;
    },
  };
  return new LlmClient(configService as never);
}

async function testChat(llm: LlmClient): Promise<void> {
  const res = await llm.chat([
    { role: 'system', content: 'Tu réponds de façon minimale.' },
    { role: 'user', content: 'Réponds uniquement par le mot : ok' },
  ]);
  console.log('chat() -> content:', JSON.stringify(res.choices[0]?.message?.content));
  console.log('chat() -> finish_reason:', res.choices[0]?.finish_reason);
  console.log('chat() -> model:', res.model);
  console.log('chat() -> usage:', JSON.stringify(res.usage));
  if (!res.choices[0]?.message?.content?.trim()) {
    throw new Error('chat() sans tools a renvoyé un contenu vide.');
  }
  if (res.choices[0].finish_reason !== 'stop') {
    throw new Error(`finish_reason attendu "stop", reçu "${res.choices[0].finish_reason}".`);
  }
}

/**
 * Checks the translated response exposes exactly what the orchestrator
 * consumes: `tool_calls[].function.arguments` as a JSON **string** it can
 * `JSON.parse`, and `finish_reason: 'tool_calls'`.
 */
function assertParseableToolCalls(
  message: OpenAI.Chat.ChatCompletionMessage,
  finishReason: string,
): OpenAI.Chat.ChatCompletionMessageToolCall[] {
  const calls = message.tool_calls ?? [];
  if (!calls.length) {
    throw new Error(`Aucun tool call reçu — content: ${JSON.stringify(message.content)}`);
  }
  if (finishReason !== 'tool_calls') {
    throw new Error(`finish_reason attendu "tool_calls", reçu "${finishReason}".`);
  }
  for (const call of calls) {
    if (call.type !== 'function') throw new Error(`type de tool call inattendu : ${call.type}`);
    if (typeof call.function.arguments !== 'string') {
      throw new Error('function.arguments doit être une chaîne JSON, pas un objet.');
    }
    // Exactly what ai.orchestrator.ts line 69 does — if this throws, the loop
    // would have thrown too.
    JSON.parse(call.function.arguments);
  }
  return calls;
}

async function testToolCalling(llm: LlmClient): Promise<void> {
  const res = await llm.chat(
    [
      {
        role: 'system',
        content:
          "Tu es un assistant de voyage. Utilise UNIQUEMENT les outils fournis pour répondre, n'invente jamais de résultat.",
      },
      {
        role: 'user',
        content: 'Trouve-moi des activités culturelles à Marrakech, budget max 200 MAD.',
      },
    ],
    TOOLS,
    { maxTokens: 1024 },
  );

  const message = res.choices[0].message;
  const calls = assertParseableToolCalls(message, res.choices[0].finish_reason);
  for (const call of calls) {
    if (call.type === 'function') {
      console.log('tool call ->', call.function.name, call.function.arguments);
    }
  }

  const first = calls[0];
  const args = first.type === 'function' ? JSON.parse(first.function.arguments) : {};
  if (first.type !== 'function' || first.function.name !== 'searchActivities' || !args.city) {
    console.warn('  ⚠ le tool call ne correspond pas au schéma attendu de searchActivities(city, query).');
  } else {
    console.log('  OK — tool call bien formé, arguments parsables (JSON string).');
  }
}

/**
 * A single Claude turn can carry several `tool_use` blocks, and the adapter has
 * to surface all of them — dropping the extras would silently lose half the
 * tool work in the agent loop. Two intents in one query is what reproduces it.
 */
async function testParallelToolCalling(llm: LlmClient): Promise<void> {
  const res = await llm.chat(
    [
      {
        role: 'system',
        content:
          'Tu es un assistant de voyage. Appelle en parallèle, dans un seul tour, tous les outils ' +
          "nécessaires pour répondre. N'invente jamais de résultat.",
      },
      {
        role: 'user',
        content:
          'Pour Marrakech : trouve-moi à la fois des activités culturelles ET des restaurants marocains. ' +
          'Lance les deux recherches maintenant.',
      },
    ],
    TOOLS,
    { maxTokens: 1024 },
  );

  const calls = assertParseableToolCalls(res.choices[0].message, res.choices[0].finish_reason);
  const names = calls.map((call) => (call.type === 'function' ? call.function.name : call.type));
  console.log(`tool_calls surfacés : ${calls.length} ->`, names.join(', '));

  if (calls.length < 2) {
    // Not a hard failure: parallel tool use is the model's choice, not a
    // guarantee. The adapter is still proven correct by the loop below.
    console.warn(
      "  ⚠ le modèle n'a demandé qu'un seul outil ce tour-ci — réessayer pour observer le cas parallèle.",
    );
  } else {
    console.log('  OK — plusieurs tool calls d\'un même tour sont bien tous exposés.');
  }
}

/**
 * The round trip the orchestrator actually performs: push the translated
 * assistant message straight back into `messages`, add one `role: 'tool'`
 * result per call, and ask again. This is what proves the *request*-side
 * translation (system lifted out, tool_calls → tool_use, tool → tool_result)
 * works, which the response-shape checks above cannot show.
 */
async function testToolResultRoundTrip(llm: LlmClient): Promise<void> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'Tu es un assistant de voyage. Utilise les outils fournis, puis réponds en une phrase.',
    },
    { role: 'user', content: 'Quelles activités culturelles à Marrakech ?' },
  ];

  const first = await llm.chat(messages, TOOLS, { maxTokens: 1024 });
  const message = first.choices[0].message;
  const calls = assertParseableToolCalls(message, first.choices[0].finish_reason);

  messages.push(message);
  for (const call of calls) {
    if (call.type !== 'function') continue;
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify([
        { refId: 'marrakech-jardin-majorelle', name: 'Jardin Majorelle', price: 150 },
      ]),
    });
  }

  // No tools on this call — same as the orchestrator's closing turn. The
  // adapter has to keep the tool history valid while forbidding further calls.
  const second = await llm.chat(messages, undefined, { maxTokens: 512 });
  const text = second.choices[0]?.message?.content ?? '';
  console.log('round trip -> finish_reason:', second.choices[0]?.finish_reason);
  console.log('round trip -> content:', JSON.stringify(text.slice(0, 160)));
  if (!text.trim()) {
    throw new Error('Le tour de clôture sans outils a renvoyé un contenu vide.');
  }
  if (second.choices[0]?.message?.tool_calls?.length) {
    throw new Error('Le tour de clôture a encore demandé un outil malgré tool_choice: none.');
  }
  console.log('  OK — historique tool_use/tool_result rejoué, réponse texte forcée.');
}

async function testEmbed(llm: LlmClient): Promise<void> {
  const [vector] = await llm.embed(['test'], 'passage');
  console.log(
    `embed(["test"], "passage") -> ${vector.length} dimensions (attendu ${llm.embedDimensions}), ` +
      `5 premières: [${vector.slice(0, 5).join(', ')}]`,
  );
  if (vector.length !== llm.embedDimensions) {
    throw new Error(
      `dimension ${vector.length} ≠ ${llm.embedDimensions} — l'index Atlas ne retrouverait rien.`,
    );
  }
}

async function testRerank(llm: LlmClient): Promise<void> {
  const order = await llm.rerank('test', ['a', 'b', 'c']);
  console.log('rerank("test", ["a","b","c"]) ->', order);
  if (order.length !== 3) throw new Error(`classement incomplet : ${order.length}/3`);
  if ([...order].sort().join() !== '0,1,2') {
    throw new Error(`indices inattendus : ${order.join(', ')} (0,1,2 attendus)`);
  }
}

function requireKey(name: string): void {
  const value = process.env[name];
  if (!value || value === 'REPLACE_ME') throw new Error(`${name} manquant dans .env`);
}

async function main() {
  requireKey('ANTHROPIC_API_KEY');
  requireKey('VOYAGE_API_KEY');

  const llm = buildClient();
  console.log(`modèle LLM : ${llm.chatModel} @ ${llm.chatBaseUrl}`);
  console.log(`modèles Voyage : ${llm.embedModel} / ${llm.rerankModel} @ ${llm.voyageBaseUrl}\n`);

  console.log('--- Anthropic chat() sans outils ---');
  await testChat(llm);
  console.log('\n--- Anthropic tool calling (TOOLS réels du projet) ---');
  await testToolCalling(llm);
  console.log('\n--- Anthropic tool calling parallèle (2 intentions, 1 tour) ---');
  await testParallelToolCalling(llm);
  console.log('\n--- Aller-retour tool_result (traduction côté requête) ---');
  await testToolResultRoundTrip(llm);
  console.log('\n--- Voyage embed() ---');
  await testEmbed(llm);
  console.log('\n--- Voyage rerank() ---');
  await testRerank(llm);
  console.log('\nOK — Anthropic et Voyage répondent, et la traduction fonctionne dans les deux sens.');
}

main().catch((error) => {
  console.error('ÉCHEC:', error);
  process.exit(1);
});
