// Denormalized read model matching the frontend mock's Trip/DayPlan/
// ActivityItem contract field-for-field (frontend/src/data/trips.ts:14-227).
// No shared package exists between frontend and backend today — these
// interfaces are intentionally duplicated here rather than imported; keep
// them in sync by hand if the frontend contract changes.
export interface PlaceImageView {
  url: string;
  credit: string;
  license: string;
}

export type ActivityItemKind = 'activity' | 'restaurant' | 'transport';
export type PriceConfidenceView = 'high' | 'medium' | 'low' | 'estimated' | 'unknown';
export type ActivityItemStatusView = 'to_visit' | 'confirmed' | 'visited' | 'missed';

export interface ActivityItemView {
  id: string;
  /**
   * Catalogue slug this item points at (Activity/Restaurant `_id`), or the
   * free-text label for a transport leg. Distinct from `id`, which is the
   * TripActivity row. The UI needs it to fetch the full catalogue record —
   * address, opening hours, sources — that this view deliberately omits.
   */
  refId: string;
  startTime: string;
  endTime: string;
  name: string;
  kind: ActivityItemKind;
  category: string;
  categoryLabel: string;
  description: string;
  durationMin: number;
  price: number | null;
  priceConfidence: PriceConfidenceView;
  isFree: boolean;
  image: PlaceImageView | null;
  status: ActivityItemStatusView;
}

export interface VisitProgressView {
  total: number;
  toVisit: number;
  confirmed: number;
  visited: number;
  missed: number;
  percentVisited: number;
  percentResolved: number;
}

export interface DayPlanView {
  id: string;
  dayNumber: number;
  date: string;
  city: string;
  title: string;
  tags: string[];
  weatherC: number;
  weatherLabel: string;
  heroImage: PlaceImageView | null;
  activities: ActivityItemView[];
}

export type BudgetCategoryKey = 'hebergement' | 'activites' | 'restauration' | 'transport';

export interface BudgetCategoryView {
  key: BudgetCategoryKey;
  label: string;
  amount: number;
  color: string;
}

export type TripStatusView = 'draft' | 'confirmed' | 'completed';

export interface TripView {
  id: string;
  status: TripStatusView;
  destinationLabel: string;
  title: string;
  dateRangeLabel: string;
  startDate: string;
  travelers: number;
  days: DayPlanView[];
  themes: string[];
  activitiesRetained: number;
  activitiesConsidered: number;
  budgetPerPersonMAD: number;
  budgetCategories: BudgetCategoryView[];
  /** Group total the traveler set in the wizard — not divided by travelers, unlike budgetPerPersonMAD. */
  budgetTotalMAD: number;
  /** Group total of everything currently selected (known + estimated costs). */
  budgetEstimatedMAD: number;
  /** budgetTotalMAD - budgetEstimatedMAD — negative once the plan goes over. */
  budgetRemainingMAD: number;
  /** BudgetService.calculate()'s alerts (over budget, items with unknown cost) — previously computed and silently dropped. */
  budgetAlerts: string[];
  aiNote: string;
  coverImage: PlaceImageView | null;
}
