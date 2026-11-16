import { Injectable } from '@nestjs/common';
import { BudgetCategory, BudgetLineItem, BudgetResult } from './budget.types';

const CATEGORIES: BudgetCategory[] = ['activities', 'food', 'accommodation', 'transport'];

// Working assumption from the dataset's meta.assumptionsToCalibrate — not
// sourced, only used to *estimate* a restaurant cost when no price is known.
// Keep in sync with data/morocco_dataset.json meta.assumptionsToCalibrate.
const PRICE_LEVEL_TO_MAD: Record<string, number> = {
  $: 80,
  $$: 200,
  $$$: 450,
  $$$$: 600, // upper bound is open-ended in the dataset — pick a conservative ceiling
};

@Injectable()
export class BudgetService {
  // Deterministic — this is the single source of truth for money math.
  // The LLM never computes a total; it only calls this through the
  // `calculateBudget` tool and reads the result back.
  calculate(items: BudgetLineItem[], budgetTotal: number): BudgetResult {
    const byCategory: Record<BudgetCategory, number> = {
      activities: 0,
      food: 0,
      accommodation: 0,
      transport: 0,
    };
    const byDayMap = new Map<number, number>();
    const unknownCostItems: string[] = [];
    const estimatedItems: string[] = [];
    let estimated = 0;

    for (const item of items) {
      if (item.cost === null) {
        unknownCostItems.push(item.tripActivityId);
        continue;
      }
      if (item.isEstimate) estimatedItems.push(item.tripActivityId);

      byCategory[item.category] += item.cost;
      byDayMap.set(item.day, (byDayMap.get(item.day) ?? 0) + item.cost);
      estimated += item.cost;
    }

    const byDay = [...byDayMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, amount]) => ({ day, amount }));

    const alerts: string[] = [];
    const remaining = budgetTotal - estimated;
    if (remaining < 0) {
      alerts.push(`Budget dépassé de ${Math.abs(remaining)} MAD.`);
    }
    if (unknownCostItems.length) {
      alerts.push(`${unknownCostItems.length} élément(s) au coût non renseigné, exclu(s) du total.`);
    }

    return {
      total: budgetTotal,
      estimated,
      remaining,
      byCategory,
      byDay,
      unknownCostItems,
      estimatedItems,
      alerts,
    };
  }

  // §10 "Traitement des valeurs inconnues" — resolves one dataset row's
  // cost, applying the rules in order. Never guesses beyond what the
  // table below documents.
  resolveActivityCost(params: {
    isFree: boolean;
    price: number | null;
    priceRange: [number, number] | null;
    priceConfidence: 'high' | 'medium' | 'low' | null;
    travelers: number;
  }): { cost: number | null; isEstimate: boolean } {
    if (params.isFree) return { cost: 0, isEstimate: false };
    if (params.price !== null) return { cost: params.price * params.travelers, isEstimate: false };
    if (params.priceRange) {
      const upperBound = params.priceRange[1];
      return { cost: upperBound * params.travelers, isEstimate: true };
    }
    return { cost: null, isEstimate: false };
  }

  resolveRestaurantCost(params: {
    priceLevel: string | null;
    avgPricePerPerson: number | null;
    travelers: number;
  }): { cost: number | null; isEstimate: boolean } {
    if (params.avgPricePerPerson !== null) {
      return { cost: params.avgPricePerPerson * params.travelers, isEstimate: false };
    }
    if (params.priceLevel && PRICE_LEVEL_TO_MAD[params.priceLevel] !== undefined) {
      return { cost: PRICE_LEVEL_TO_MAD[params.priceLevel] * params.travelers, isEstimate: true };
    }
    return { cost: null, isEstimate: false };
  }

  get categories(): BudgetCategory[] {
    return CATEGORIES;
  }
}
