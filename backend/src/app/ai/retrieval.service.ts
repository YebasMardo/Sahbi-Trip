import { Injectable, Logger } from '@nestjs/common';
import { ActivitiesService } from 'src/app/activities/activities.service';
import { LlmClient } from './llm.client';
import { TripProfile } from './schemas';
import { ScoringCandidate } from './scoring.service';

export interface RetrievedActivity {
  refId: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  isFree: boolean;
  price: number | null;
  priceRange: [number, number] | null;
  priceConfidence: 'high' | 'medium' | 'low' | null;
  priceNote: string | null;
  duration: number | null;
  openingHours: string | null;
  touristLevel: 'low' | 'medium' | 'high';
  coordinates: { lat: number; lng: number } | null;
  requiresBooking: boolean;
}

const NUM_CANDIDATES = 200;
const VECTOR_SEARCH_LIMIT = 50;

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly llmClient: LlmClient,
  ) {}

  // Embed + $vectorSearch + code filters (budget/season) — the first
  // stage of the two-stage RAG (guide §8 Étape B). Falls back to a plain
  // filtered query if the embedding/vector-search call fails (e.g. Voyage
  // unreachable or the Atlas index missing), so the rest of the pipeline
  // still has candidates to rerank and score against.
  async search(profile: TripProfile, city: string): Promise<RetrievedActivity[]> {
    let raw: any[];
    try {
      const query = this.buildSemanticQuery(profile, city);
      const [queryVector] = await this.llmClient.embed([query], 'query');
      raw = await this.activitiesService
        .aggregateRaw([
          {
            $vectorSearch: {
              index: 'activities_vector',
              path: 'embedding',
              queryVector,
              numCandidates: NUM_CANDIDATES,
              limit: VECTOR_SEARCH_LIMIT,
              filter: { city },
            },
          },
          { $project: { embedding: 0 } },
        ])
        .exec();
    } catch (error) {
      this.logger.warn(
        `Vector search unavailable (${(error as Error)?.message}) — falling back to a plain city query.`,
      );
      raw = await this.activitiesService.aggregateRaw([{ $match: { city } }, { $project: { embedding: 0 } }]).exec();
    }

    return raw
      .map((doc) => this.toRetrieved(doc))
      .filter((activity) => this.passesBudgetFilter(activity, profile))
      .filter((activity) => this.passesSeasonFilter(activity, profile));
  }

  // Reranks candidates against the same semantic query used for retrieval.
  // Returns them tagged with a 0..1 normalised rerank score, ready for
  // ScoringService. Falls back to rank-order-derived scores if the
  // reranker is unavailable.
  async rerank(
    profile: TripProfile,
    city: string,
    candidates: RetrievedActivity[],
  ): Promise<ScoringCandidate[]> {
    if (!candidates.length) return [];
    const query = this.buildSemanticQuery(profile, city);
    const passages = candidates.map((c) => this.toPassageText(c));

    let order: number[];
    try {
      order = await this.llmClient.rerank(query, passages, candidates.length);
    } catch (error) {
      this.logger.warn(`Rerank unavailable (${(error as Error)?.message}) — keeping retrieval order.`);
      order = candidates.map((_, i) => i);
    }

    return order.map((index, rank) => {
      const candidate = candidates[index];
      return {
        refId: candidate.refId,
        category: candidate.category,
        tags: candidate.tags,
        isFree: candidate.isFree,
        price: candidate.price,
        priceRange: candidate.priceRange,
        touristLevel: candidate.touristLevel,
        coordinates: candidate.coordinates,
        // Normalise by rank position — index 0 (best) gets 1, last gets ~0.
        rerankScore: order.length > 1 ? 1 - rank / (order.length - 1) : 1,
      };
    });
  }

  private buildSemanticQuery(profile: TripProfile, city: string): string {
    const interests = profile.interests.join(', ') || 'découverte générale';
    const avoid = profile.avoid.length ? ` À éviter : ${profile.avoid.join(', ')}.` : '';
    return `Activités ${interests} à ${city}.${avoid}`;
  }

  private toPassageText(activity: RetrievedActivity): string {
    const price = activity.isFree
      ? 'gratuit'
      : activity.price !== null
        ? `${activity.price} MAD`
        : 'prix non renseigné';
    return `${activity.name} — ${activity.category} — ${activity.description} — ${price}`;
  }

  private toRetrieved(doc: any): RetrievedActivity {
    return {
      refId: doc._id,
      name: doc.name,
      category: doc.category,
      description: doc.description,
      tags: doc.tags ?? [],
      isFree: doc.isFree,
      price: doc.price ?? null,
      priceRange: doc.priceRange ?? null,
      priceConfidence: doc.priceConfidence ?? null,
      priceNote: doc.priceNote ?? null,
      duration: doc.duration ?? null,
      openingHours: doc.openingHours ?? null,
      touristLevel: doc.touristLevel,
      coordinates: doc.coordinates ? { lat: doc.coordinates.lat, lng: doc.coordinates.lng } : null,
      requiresBooking: doc.requiresBooking ?? false,
    };
  }

  private passesBudgetFilter(activity: RetrievedActivity, profile: TripProfile): boolean {
    if (activity.isFree) return true;
    const perActivityBudget = profile.budgetTotal / (profile.durationDays ?? 1) / 2;
    if (activity.price !== null) return activity.price <= perActivityBudget * 3; // generous ceiling — real cut happens in scoring/budget
    if (activity.priceRange) return activity.priceRange[0] <= perActivityBudget * 3;
    return true; // unknown cost — never excluded, flagged downstream instead (§10)
  }

  // Heuristic proxy for the "été" (summer-only) tag used by a handful of
  // dataset entries (e.g. Tamaris Aquaparc) — the dataset has no structured
  // season boundaries, only free-text openingHours/priceNote.
  private passesSeasonFilter(activity: RetrievedActivity, profile: TripProfile): boolean {
    if (!activity.tags.includes('été')) return true;
    if (!profile.startDate) return true;
    const month = new Date(profile.startDate).getMonth() + 1; // 1..12
    return month >= 5 && month <= 9;
  }
}
