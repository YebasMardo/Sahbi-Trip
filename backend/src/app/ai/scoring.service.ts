import { Injectable } from '@nestjs/common';

// Guide §11.5 — interest (wizard) → dataset category/tag mapping.
const INTEREST_TO_CATEGORIES: Record<string, string[]> = {
  culture: ['culture', 'histoire', 'medina'],
  histoire: ['histoire', 'culture'],
  nature: ['nature', 'parc', 'promenade'],
  plage: ['plage'],
  shopping: ['shopping', 'medina'],
  famille: ['zoo', 'parc-attractions'],
  aventure: ['parc-attractions'],
  vie_nocturne: [],
  artisanat: ['medina', 'shopping'],
  panoramas: ['promenade', 'place'],
  bien_etre: ['parc', 'promenade'],
  art: ['culture'],
};

// Free-text `tags` on a catalogue row are far richer than `category` (see
// data/morocco_dataset.json) — this lets an interest match on vibe/theme
// even when no category fits. Without it `vie_nocturne` (no category at
// all) could never score above the "no match" floor.
const INTEREST_TO_TAGS: Record<string, string[]> = {
  vie_nocturne: ['soirée', 'rooftop', 'jazz', 'bar'],
  artisanat: ['artisanat', 'souk', 'souks'],
  panoramas: ['vue', 'vue-mer', 'panorama', 'coucher-de-soleil', 'rooftop'],
  bien_etre: ['détente', 'calme'],
  art: ['art', 'galerie', 'expositions', 'musée'],
  gastronomie: ['street-food', 'pâtisserie', 'café', 'dîner', 'déjeuner'],
};

export interface ScoringCandidate {
  refId: string;
  category: string;
  tags: string[];
  isFree: boolean;
  price: number | null;
  priceRange: [number, number] | null;
  touristLevel: 'low' | 'medium' | 'high';
  coordinates: { lat: number; lng: number } | null;
  rerankScore: number; // normalised 0..1 across the candidate set
}

export interface ScoringProfile {
  interests: string[];
  avoid: string[];
  perActivityBudget: number; // heuristic ceiling used only for the budget component
  referencePoint?: { lat: number; lng: number };
}

export interface ScoredCandidate extends ScoringCandidate {
  matchScore: number; // 0..100
}

const WEIGHTS = {
  preferenceMatch: 0.25,
  budgetCompat: 0.2,
  proximity: 0.15,
  touristFit: 0.1,
  rerankScore: 0.3,
};

const PROXIMITY_CUTOFF_KM = 15;

@Injectable()
export class ScoringService {
  score(profile: ScoringProfile, candidates: ScoringCandidate[]): ScoredCandidate[] {
    return candidates.map((candidate) => {
      const preferenceMatch = this.preferenceMatch(profile.interests, candidate);
      const budgetCompat = this.budgetCompat(profile.perActivityBudget, candidate);
      const proximity = this.proximity(profile.referencePoint, candidate.coordinates);
      const touristFit = this.touristFit(profile.avoid, candidate.touristLevel);

      const matchScore =
        WEIGHTS.preferenceMatch * preferenceMatch +
        WEIGHTS.budgetCompat * budgetCompat +
        WEIGHTS.proximity * proximity +
        WEIGHTS.touristFit * touristFit +
        WEIGHTS.rerankScore * candidate.rerankScore;

      return { ...candidate, matchScore: Math.round(matchScore * 100) };
    });
  }

  private preferenceMatch(interests: string[], candidate: ScoringCandidate): number {
    if (!interests.length) return 0.5; // no stated preference — neutral
    const matched = interests.some((interest) => {
      const categories = INTEREST_TO_CATEGORIES[interest] ?? [interest];
      const relatedTags = INTEREST_TO_TAGS[interest] ?? [];
      return (
        categories.includes(candidate.category) ||
        candidate.tags.includes(interest) ||
        relatedTags.some((tag) => candidate.tags.includes(tag))
      );
    });
    return matched ? 1 : 0.2;
  }

  private budgetCompat(perActivityBudget: number, candidate: ScoringCandidate): number {
    if (candidate.isFree) return 1;
    const cost = candidate.price ?? candidate.priceRange?.[1] ?? null;
    if (cost === null) return 0.5; // unknown cost — neutral, never penalised (§10)
    if (cost <= perActivityBudget) return 1;
    const overshoot = (cost - perActivityBudget) / perActivityBudget;
    return Math.max(0, 1 - overshoot);
  }

  private proximity(
    reference: { lat: number; lng: number } | undefined,
    coordinates: { lat: number; lng: number } | null,
  ): number {
    if (!reference || !coordinates) return 0.5; // §10: coordinates null → neutral
    const km = haversineKm(reference, coordinates);
    return Math.max(0, 1 - km / PROXIMITY_CUTOFF_KM);
  }

  private touristFit(avoid: string[], touristLevel: 'low' | 'medium' | 'high'): number {
    if (!avoid.includes('overly_touristic')) return 1; // not a stated concern — no penalty
    return { low: 1, medium: 0.5, high: 0 }[touristLevel];
  }
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
