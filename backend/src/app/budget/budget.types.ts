export type BudgetCategory = 'activities' | 'food' | 'accommodation' | 'transport';

export interface BudgetLineItem {
  tripActivityId: string;
  category: BudgetCategory;
  day: number;
  // Cost per group (already multiplied by travelers where relevant), or
  // null if genuinely unknown (§10 "Traitement des valeurs inconnues").
  cost: number | null;
  isEstimate: boolean;
  priceConfidence: 'high' | 'medium' | 'low' | null;
  label: string;
}

export interface BudgetResult {
  total: number;
  estimated: number; // sum of known + estimated costs
  remaining: number;
  byCategory: Record<BudgetCategory, number>;
  byDay: { day: number; amount: number }[];
  unknownCostItems: string[]; // tripActivityId list
  estimatedItems: string[]; // tripActivityId list
  alerts: string[];
}
