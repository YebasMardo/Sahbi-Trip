/**
 * Server contract for trips, the catalogue and the AI pipeline.
 *
 * The view types below mirror `backend/src/app/trips/trip-view.dto.ts`
 * field-for-field — that DTO is the backend's denormalized read model, built
 * specifically so the UI never has to assemble a trip from raw rows. There is
 * no shared package between the two sides today, so these are duplicated by
 * hand; keep them in sync when the DTO changes.
 */

// ── Trip view model (GET /trips, GET /trips/:id/view) ────────────────

export interface PlaceImage {
  url: string
  credit: string
  license: string
}

export type ActivityItemKind = 'activity' | 'restaurant' | 'transport'
export type PriceConfidence = 'high' | 'medium' | 'low' | 'estimated' | 'unknown'
export type ActivityItemStatus = 'to_visit' | 'confirmed' | 'visited' | 'missed'
export type TripStatus = 'draft' | 'confirmed' | 'completed'

export interface ActivityItem {
  /** TripActivity row id — what the PATCH/DELETE endpoints take. */
  id: string
  /** Catalogue slug the item points at, for fetching the full place record. */
  refId: string
  startTime: string
  endTime: string
  name: string
  kind: ActivityItemKind
  category: string
  categoryLabel: string
  description: string
  durationMin: number
  price: number | null
  priceConfidence: PriceConfidence
  isFree: boolean
  image: PlaceImage | null
  status: ActivityItemStatus
}

export interface DayPlan {
  id: string
  dayNumber: number
  date: string
  city: string
  title: string
  tags: string[]
  weatherC: number
  weatherLabel: string
  heroImage: PlaceImage | null
  activities: ActivityItem[]
}

export type BudgetCategoryKey = 'hebergement' | 'activites' | 'restauration' | 'transport'

export interface BudgetCategory {
  key: BudgetCategoryKey
  label: string
  amount: number
  color: string
}

export interface Trip {
  id: string
  status: TripStatus
  destinationLabel: string
  title: string
  dateRangeLabel: string
  startDate: string
  travelers: number
  days: DayPlan[]
  themes: string[]
  activitiesRetained: number
  activitiesConsidered: number
  budgetPerPersonMAD: number
  budgetCategories: BudgetCategory[]
  budgetTotalMAD: number
  budgetEstimatedMAD: number
  budgetRemainingMAD: number
  budgetAlerts: string[]
  aiNote: string
  coverImage: PlaceImage | null
}

// ── Write payloads ──────────────────────────────────────────────────

export type ComfortLevel = 'budget' | 'mid-range' | 'luxury'
export type TransportMode = 'car' | 'public' | 'walk' | 'mixed'
export type TravelerType = 'solo' | 'couple' | 'family' | 'group'
export type Pace = 'relaxed' | 'balanced' | 'intense'
/** Preferred inter-city carrier — distinct from TransportMode (in-city style). */
export type IntercityTransportMode = 'train' | 'bus' | 'taxi' | 'any'

export interface CityDuration {
  city: string
  days: number
}

/** Mirrors `CreateTripDto`. No `owner` — the backend takes it from the token. */
export interface CreateTripPayload {
  title?: string
  startDate: string
  endDate: string
  durationDays: number
  travelers: number
  budgetTotal: number
  budgetAccommodation?: number
  budgetActivities?: number
  currency?: string
  cities: string[]
  interests?: string[]
  avoid?: string[]
  comfort?: ComfortLevel
  transport?: TransportMode
  cityDurations?: CityDuration[]
  intercityTransport?: IntercityTransportMode
  travelerType?: TravelerType
  alreadyInMorocco?: boolean
  currentCity?: string
  pace?: Pace
  dietary?: string[]
  travelNotes?: string
  language?: string
}

/** Raw `Trip` document as returned by POST /trips — not the view model. */
export interface TripRecord {
  id: string
  status: 'draft' | 'generating' | 'generated' | 'filling' | 'confirmed'
  title?: string
  startDate: string
  endDate: string
  durationDays: number
  travelers: number
  budgetTotal: number
  cities: string[]
  interests: string[]
  avoid: string[]
  dashboardVersion: number
}

export interface AddActivityPayload {
  tripId: string
  type: 'activity' | 'restaurant'
  refId: string
  day: number
  startTime: string
  endTime: string
}

export interface AddTransportLegPayload {
  tripId: string
  day: number
  city: string
  fromCity: string
  toCity: string
  mode: TransportMode
  startTime: string
  endTime: string
  label?: string
}

export interface UpdateActivityPayload {
  tripId: string
  taId: string
  type?: 'activity' | 'restaurant'
  refId?: string
  startTime?: string
  endTime?: string
  status?: ActivityItemStatus
}

export interface DeleteActivityPayload {
  tripId: string
  taId: string
}

// ── AI-driven operations ────────────────────────────────────────────

/** Mirrors the Zod `TripProfileSchema` the extractor validates against. */
export interface TripProfile {
  startDate?: string | null
  endDate?: string | null
  durationDays?: number | null
  travelers: number
  budgetTotal: number
  budgetAccommodation?: number | null
  currency: string
  cities: string[]
  interests: string[]
  avoid: string[]
  comfort?: string | null
  transport?: string | null
  cityDurations?: CityDuration[]
  intercityTransport?: string | null
  travelerType?: string | null
  alreadyInMorocco: boolean
  currentCity?: string | null
  pace?: string | null
  dietary?: string[]
  budgetActivities?: number | null
  travelNotes?: string | null
  language: string
}

export interface ReplaceAlternative {
  activityId: string
  reason: string
}

export interface OptimizeResult {
  order: Array<{ tripActivityId: string; startTime: string }>
  explanation: string
}

export interface ChatResult {
  reply: string
}

export interface DashboardStatus {
  status: string
  dashboardVersion: number
  dashboardReady: boolean
}

// ── Catalogue (GET /activities, GET /restaurants) ────────────────────

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface CatalogueImage {
  url: string | null
  thumbnailUrl: string | null
  credit: string | null
  license: string | null
  licenseUrl: string | null
  sourceUrl: string | null
  status: string
  isIllustrative?: boolean
}

export interface CatalogueActivity {
  id: string
  name: string
  city: string
  category: string
  description: string
  price: number | null
  priceRange: [number, number] | null
  priceNote: string | null
  priceConfidence: 'high' | 'medium' | 'low' | null
  isFree: boolean
  duration: number | null
  openingHours: string | null
  address: string | null
  website: string | null
  phone: string | null
  coordinates: { lat: number; lng: number; precision?: string } | null
  touristLevel: 'low' | 'medium' | 'high'
  requiresBooking: boolean
  tags: string[]
  image: CatalogueImage
  sources: string[]
  lastChecked: string
  rating: number | null
  userRatingCount: number | null
  /** Field names on this item that are fabricated demo placeholders — see DemoDataBadge. */
  demoDataFields?: string[]
}

export interface CatalogueRestaurant {
  id: string
  name: string
  city: string
  cuisine: string
  description: string
  priceLevel: string | null
  avgPricePerPerson: number | null
  address: string | null
  openingHours: string | null
  phone: string | null
  email: string | null
  website: string | null
  coordinates: { lat: number; lng: number; precision?: string } | null
  tags: string[]
  image: CatalogueImage
  sources: string[]
  lastChecked: string
  rating: number | null
  userRatingCount: number | null
  /** Field names on this item that are fabricated demo placeholders — see DemoDataBadge. */
  demoDataFields?: string[]
}

export interface ActivityStats {
  byCity: Array<{ city: string; total: number; free: number }>
  total: number
  free: number
}

export interface RestaurantStats {
  byCity: Array<{ city: string; total: number }>
  total: number
}

export interface ActivitiesQuery {
  city?: string
  category?: string
  isFree?: boolean
  touristLevel?: string
  maxPrice?: number
  query?: string
  page?: number
  limit?: number
}

export interface RestaurantsQuery {
  city?: string
  cuisine?: string
  priceLevel?: string
  query?: string
  page?: number
  limit?: number
}

/**
 * One catalogue place, normalised so activities and restaurants can share the
 * ActivityPicker list. Built client-side by the picker's mapping helpers.
 */
export interface PickerPlace {
  refId: string
  type: 'activity' | 'restaurant'
  name: string
  city: string
  category: string
  description: string
  durationMin: number
  price: number | null
  isFree: boolean
  image: PlaceImage | null
  /** Restaurants only — the dataset gives a `$`..`$$$$` bracket, never a MAD figure. */
  priceLevel?: string | null
  rating: number | null
  userRatingCount: number | null
  /** Field names on this item that are fabricated demo placeholders — see DemoDataBadge. */
  demoDataFields?: string[]
}

export type PickerKindFilter = 'all' | 'activity' | 'restaurant'

// ── AI provider health (GET /ai/health) ─────────────────────────────

export interface ProviderHealth {
  model: string
  baseUrl: string
  ok: boolean
  latencyMs: number
  error?: string
}

export interface AiHealthReport {
  llm: ProviderHealth
  embed: ProviderHealth
  rerank: ProviderHealth
}
