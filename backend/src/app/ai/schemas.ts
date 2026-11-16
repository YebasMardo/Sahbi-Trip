import { z } from 'zod';

// Guide §12.1 — output of ProfileExtractor.extract() and input of
// AiService.generateItinerary(). Free-text extraction always goes through
// this schema before anything downstream trusts it (§2 rule 4).
export const TripProfileSchema = z.object({
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  travelers: z.number().int().positive(),
  budgetTotal: z.number().nonnegative(),
  budgetAccommodation: z.number().nonnegative().nullable().optional(),
  currency: z.string().default('MAD'),
  cities: z.array(z.string()).min(1),
  interests: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  comfort: z.string().nullable().optional(),
  transport: z.string().nullable().optional(),
  // Days at each city (2+ cities only) and preferred inter-city carrier
  // (train/bus/taxi/any) — see backend/src/app/ai/transport-pricing.util.ts.
  cityDurations: z.array(z.object({ city: z.string(), days: z.number().int().positive() })).default([]),
  intercityTransport: z.string().nullable().optional(),
  travelerType: z.string().nullable().optional(),
  alreadyInMorocco: z.boolean().default(false),
  currentCity: z.string().nullable().optional(),
  // Rythme souhaité — advisory: steers how many activities the planner packs
  // per day (guide addition, not part of the original §12.1 schema).
  pace: z.string().nullable().optional(),
  // Contraintes de repas (végétarien, sans gluten...) — advisory, no dataset
  // field to filter on, but the planner reasons over restaurant descriptions.
  dietary: z.array(z.string()).default([]),
  // Optional per-category ceiling, same spirit as budgetAccommodation.
  budgetActivities: z.number().nonnegative().nullable().optional(),
  // Free-text catch-all (allergies, mobility needs, special occasion...) —
  // appended verbatim to the planner's user message rather than modeled as
  // yet another structured field for every possible edge case.
  travelNotes: z.string().nullable().optional(),
  language: z.string().default('fr'),
});
export type TripProfile = z.infer<typeof TripProfileSchema>;

// Guide §12.2 — output of AiService.generateItinerary() (the proposal, not
// yet the confirmed dashboard).
const ItineraryItemSchema = z.object({
  type: z.enum(['activity', 'restaurant', 'transport']),
  // Activity or Restaurant catalogue slug; for type "transport" a
  // self-made descriptive label instead (no catalogue row exists).
  activityId: z.string(),
  startTime: z.string().nullable(),
  durationMin: z.number().nullable(),
  estimatedCost: z.number().nullable(),
  costIsEstimate: z.boolean(),
  priceConfidence: z.enum(['high', 'medium', 'low']).nullable(),
  matchScore: z.number().min(0).max(100),
  reason: z.string(),
});

const ItineraryDaySchema = z.object({
  day: z.number().int().positive(),
  city: z.string(),
  items: z.array(ItineraryItemSchema),
  dayBudget: z.number(),
});

export const ItinerarySchema = z.object({
  summary: z.object({
    days: z.number().int().positive(),
    cities: z.number().int().positive(),
    activitiesConsidered: z.number().int().nonnegative(),
    activitiesSelected: z.number().int().nonnegative(),
  }),
  days: z.array(ItineraryDaySchema),
  budget: z.object({
    total: z.number(),
    estimated: z.number(),
    remaining: z.number(),
  }),
  warnings: z.array(z.string()).default([]),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;

// Guide §8 Étape G — output of DashboardFillerService.fill().
const TravelLegSchema = z.object({
  km: z.number().nullable(),
  minutes: z.number().nullable(),
  cost: z.number().nullable(),
});

const DashboardItineraryItemSchema = z.object({
  tripActivityId: z.string(),
  startTime: z.string().nullable(),
  travelFromPrevious: TravelLegSchema.nullable(),
});

const DashboardItineraryDaySchema = z.object({
  day: z.number().int().positive(),
  city: z.string(),
  // Editorial narrative, produced by DashboardFillerService.generateNarrative
  // alongside overview/checklist/tips — absent in code-only degraded mode,
  // TripViewService falls back to a deterministic title/tags in that case.
  title: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  items: z.array(DashboardItineraryItemSchema),
});

const MapMarkerSchema = z.object({
  tripActivityId: z.string(),
  lat: z.number(),
  lng: z.number(),
  order: z.number().int(),
});

export const DashboardDataSchema = z.object({
  version: z.number().int().positive(),
  scope: z.enum(['all', 'day']),
  overview: z.object({
    title: z.string(),
    summary: z.string(),
    highlights: z.array(z.string()),
  }),
  budget: z.object({
    total: z.number(),
    estimated: z.number(),
    remaining: z.number(),
    byCategory: z.record(z.string(), z.number()),
    byDay: z.array(z.object({ day: z.number().int(), amount: z.number() })),
    alerts: z.array(z.string()),
  }),
  itinerary: z.array(DashboardItineraryDaySchema),
  map: z.object({ markers: z.array(MapMarkerSchema) }),
  logistics: z.object({
    accommodations: z.array(z.unknown()).default([]),
    intercity: z.array(z.unknown()).default([]),
  }),
  checklist: z.array(
    z.object({
      label: z.string(),
      type: z.enum(['booking', 'reminder', 'packing']),
      dayRef: z.number().int().nullable(),
    }),
  ),
  tips: z.array(z.object({ city: z.string(), text: z.string() })),
  warnings: z.array(z.string()),
  generatedAt: z.string(),
});
export type DashboardData = z.infer<typeof DashboardDataSchema>;
