// Standalone script — does not go through the Nest DI container, per the
// guide's own seed.ts example (§11.4). Run with `npm run seed`.
//
// Idempotent: re-running upserts every row and recomputes every embedding,
// so updating data/morocco_dataset.json and re-seeding is always safe.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import mongoose from 'mongoose';

// The real .env lives at the project root, one level up from backend/ —
// same convention as app.module.ts's ConfigModule.forRoot envFilePath.
loadEnv({ path: join(__dirname, '..', '..', '.env') });

const DATA_PATH = join(__dirname, '..', '..', 'data', 'morocco_dataset.json');
const EMBED_BATCH_SIZE = 16;
/**
 * Single source of truth for the vector width: used both when requesting
 * embeddings and when declaring the Atlas index, so the two can never drift.
 * Must stay in step with `LlmClient.embedDimensions`.
 *
 * Keeping the width at 1024 means the Atlas index definition survives an
 * embedding-provider change — but the stored vectors do NOT. Embeddings from
 * different models occupy unrelated vector spaces, so a query embedded by one
 * model scored against documents embedded by another returns noise rather
 * than failing. Any change of embedding model requires re-running this script.
 */
const EMBED_DIMENSIONS = 1024;

interface DatasetRow {
  id: string;
  type?: string;
  city: string;
  sources: string[];
  [key: string]: unknown;
}

interface Dataset {
  meta: { cities: string[]; [key: string]: unknown };
  activities: DatasetRow[];
  restaurants: DatasetRow[];
}

function loadDataset(): Dataset {
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
}

// Fails loudly on structural problems (duplicate ids, unknown city, no
// sources) — a dataset that doesn't pass this never reaches Mongo.
function validate(ds: Dataset): void {
  const cities = new Set(ds.meta.cities);
  const all = [...ds.activities, ...ds.restaurants];
  const ids = all.map((x) => x.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length) throw new Error(`Duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
  for (const row of all) {
    if (!cities.has(row.city)) throw new Error(`Unknown city for ${row.id}: ${row.city}`);
    if (!row.sources?.length) throw new Error(`Missing sources for ${row.id}`);
  }
}

function docText(row: DatasetRow): string {
  const tags = (row.tags as string[] | undefined)?.join(', ') ?? '';
  if (row.type === 'restaurant') {
    return `${row.name}. ${row.cuisine}. ${row.description}. Tags: ${tags}. Ville: ${row.city}.`;
  }
  const free = row.isFree ? ' Gratuit.' : '';
  return `${row.name}. ${row.category}. ${row.description}. Tags: ${tags}. Ville: ${row.city}. Niveau touristique: ${row.touristLevel}.${free}`;
}

/**
 * A Voyage account with no payment method is capped at **3 requests/minute**,
 * and this script's batches would otherwise go out back-to-back and trip it.
 * A 429 must be waited out rather than swallowed: `embedding: null` is written
 * on give-up, so treating a rate limit as a permanent failure would wipe the
 * vectors already stored for those rows — turning a pacing problem into data
 * loss. Roughly a 3 RPM window, with room for the limit to be per-minute.
 */
const EMBED_RATE_LIMIT_RETRIES = 4;
const EMBED_RATE_LIMIT_WAIT_MS = 21_000;
/**
 * Minimum gap between two embedding requests, tracked globally rather than per
 * collection: seedCollection() runs for activities *and* restaurants, so a
 * per-collection counter would let the last activities batch and the first
 * restaurants batch go out back-to-back and trip 3 RPM anyway.
 */
const EMBED_REQUEST_SPACING_MS = 21_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastEmbedRequestAt = 0;

/** Waits just long enough that the next request stays inside the rate limit. */
async function throttleEmbedRequest(): Promise<void> {
  const waitMs = lastEmbedRequestAt + EMBED_REQUEST_SPACING_MS - Date.now();
  if (waitMs > 0) {
    console.log(`  (pause ${Math.round(waitMs / 1000)}s pour respecter la limite Voyage)`);
    await sleep(waitMs);
  }
  lastEmbedRequestAt = Date.now();
}

// Best-effort: seeding must still succeed without VOYAGE_API_KEY set —
// embeddings stay `null` and vector search falls back to a plain query
// (see RetrievalService) until this is re-run with a real key.
//
// `output_dimension` is pinned to EMBED_DIMENSIONS rather than left to the
// model's default, so the vectors written here keep matching the
// `numDimensions` declared by the index in `ensureVectorIndex` below. The
// `document` input type must match what LlmClient sends for 'passage'.
async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  const model = process.env.VOYAGE_EMBED_MODEL ?? 'voyage-4';
  if (!apiKey) return texts.map(() => null);

  for (let attempt = 0; ; attempt++) {
    try {
      await throttleEmbedRequest();
      const res = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: texts,
          input_type: 'document',
          output_dimension: EMBED_DIMENSIONS,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 429 && attempt < EMBED_RATE_LIMIT_RETRIES) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000 + 250
          : EMBED_RATE_LIMIT_WAIT_MS;
        console.warn(
          `  rate limited (429) — waiting ${Math.round(waitMs / 1000)}s, retry ${attempt + 1}/${EMBED_RATE_LIMIT_RETRIES}.`,
        );
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { data: { index?: number; embedding: number[] }[] };
      // Voyage tags each row with its position in `input`; sorting on it keeps
      // vector i aligned with text i even if the response arrives out of order.
      return [...body.data]
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((row) => row.embedding);
    } catch (error) {
      console.warn(`  embedding batch failed (${(error as Error).message}) — storing null, retry later.`);
      return texts.map(() => null);
    }
  }
}

async function embedAll(rows: DatasetRow[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];
  const batchCount = Math.ceil(rows.length / EMBED_BATCH_SIZE);
  for (let i = 0; i < rows.length; i += EMBED_BATCH_SIZE) {
    const batchIndex = i / EMBED_BATCH_SIZE;
    const batch = rows.slice(i, i + EMBED_BATCH_SIZE).map(docText);
    console.log(`  embedding batch ${batchIndex + 1}/${batchCount} (${batch.length} rows)...`);
    results.push(...(await embedBatch(batch)));
  }
  return results;
}

// Vector Search indexes are managed at the Atlas level. Attempted here for
// convenience; on tiers/permissions that don't support programmatic index
// management this fails harmlessly and must be created by hand in the
// Atlas UI instead (see guide §8 Étape B for the exact index definition).
async function ensureVectorIndex(db: mongoose.mongo.Db): Promise<void> {
  try {
    await db.collection('activities').createSearchIndex({
      name: 'activities_vector',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: EMBED_DIMENSIONS,
            similarity: 'cosine',
          },
          { type: 'filter', path: 'city' },
          { type: 'filter', path: 'category' },
          { type: 'filter', path: 'isFree' },
          { type: 'filter', path: 'touristLevel' },
        ],
      },
    });
    console.log('  Atlas Vector Search index "activities_vector" created (or already exists).');
  } catch (error) {
    console.warn(
      `  Could not create the Vector Search index automatically (${(error as Error).message}). ` +
        'Create it by hand in the Atlas UI — see guide §8 Étape B for the definition.',
    );
  }
}

async function seedCollection(db: mongoose.mongo.Db, name: 'activities' | 'restaurants', rows: DatasetRow[]) {
  console.log(`Seeding ${name} (${rows.length} rows)...`);
  const embeddings = await embedAll(rows);
  const collection = db.collection(name);

  for (let i = 0; i < rows.length; i++) {
    const { id, ...rest } = rows[i];
    await collection.replaceOne({ _id: id as unknown as mongoose.mongo.BSON.ObjectId }, { _id: id, ...rest, embedding: embeddings[i] }, { upsert: true });
  }
  const embedded = embeddings.filter(Boolean).length;
  const missing = rows.length - embedded;
  console.log(`  ${rows.length} upserted, ${embedded} with a real embedding (${missing} null).`);
  if (missing) {
    // Worth shouting about: with null embeddings $vectorSearch silently returns
    // fewer (or no) candidates and RetrievalService falls back to a plain city
    // query, so the two-stage RAG is off without anything failing.
    console.warn(
      `  ⚠ ${missing} ligne(s) de ${name} sans embedding — la recherche vectorielle sera dégradée. ` +
        'Relancez `npm run seed` une fois le quota Voyage disponible.',
    );
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');

  const ds = loadDataset();
  validate(ds);
  console.log(`Dataset OK: ${ds.activities.length} activities, ${ds.restaurants.length} restaurants.`);

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  await seedCollection(db, 'activities', ds.activities);
  await seedCollection(db, 'restaurants', ds.restaurants);
  await db.collection('dataset_meta').replaceOne({ _id: 'meta' as unknown as mongoose.mongo.BSON.ObjectId }, { _id: 'meta', ...ds.meta }, { upsert: true });

  await ensureVectorIndex(db);

  await mongoose.disconnect();
  console.log('Seed complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
