// Deterministic transport pricing — single source of money for transport
// legs, used both by ToolDispatcher (LLM-facing tools) and by TripsService's
// manual "add transport leg" endpoint.
//
// Inter-city figures below were researched (web search, Sept 2026) against
// public fare information for the MVP's 3 covered cities — ONCF (train),
// CTM (bus) and grand taxi (shared inter-city taxi) — and rounded to a
// representative mid-range price per mode:
//   - Casablanca–Rabat  (~1h, ~87 km):  train 2nd class ~35-45 MAD, bus ~40-60 MAD,
//     shared grand taxi ~50-70 MAD (rome2rio, moroccotrains.com, comparabus.com).
//   - Casablanca–Marrakech (~2h40, ~240 km): train 2nd class ~90-150 MAD, bus ~90-120 MAD,
//     shared grand taxi ~120-150 MAD (actividees.com, comparabus.com, rome2rio).
//   - Marrakech–Rabat (~3h30-4h, ~327 km): train 2nd class ~160-220 MAD, bus (CTM) ~130-190 MAD,
//     shared grand taxi ~180-220 MAD (rome2rio, moroccotrains.com).
// Still a working table, not a live fare feed — ONCF/CTM use dynamic pricing,
// so treat these as planning estimates and re-check before booking.
export type TransportMode = 'car' | 'public' | 'walk' | 'mixed';
export type IntercityMode = 'train' | 'bus' | 'taxi';
export type IntercityPreference = IntercityMode | 'any';

interface IntercityOption {
  price: number;
  durationMin: number;
}

const INTERCITY_OPTIONS: Record<string, Record<IntercityMode, IntercityOption>> = {
  'Casablanca-Rabat': {
    train: { price: 40, durationMin: 60 },
    bus: { price: 50, durationMin: 75 },
    taxi: { price: 60, durationMin: 55 },
  },
  'Casablanca-Marrakech': {
    train: { price: 130, durationMin: 160 },
    bus: { price: 110, durationMin: 200 },
    taxi: { price: 140, durationMin: 170 },
  },
  'Marrakech-Rabat': {
    train: { price: 190, durationMin: 210 },
    bus: { price: 160, durationMin: 270 },
    taxi: { price: 200, durationMin: 220 },
  },
};

// Same-city legs — no sourced table (guide §11.6), a per-km rate the caller
// multiplies by getDistance's estimate.
const LOCAL_MAD_PER_KM: Record<TransportMode, number> = { car: 6, public: 2, walk: 0, mixed: 4 };

// Flat per-person, per-day allowance for the traveler's *local* moves within
// a city (petit taxi, city bus, occasional ride) — a working margin, not a
// sourced fare, but the itinerary otherwise budgets zero for it (the planner
// only prices explicit inter-city/airport transfers, never day-to-day local
// hops), which understates real spend. Scales with the chosen local
// transport style; keyed by the existing `transport` (in-city) preference.
export const LOCAL_DAILY_TRANSPORT_MARGIN_MAD: Record<TransportMode, number> = {
  walk: 15,
  public: 25,
  mixed: 45,
  car: 70,
};

export interface TransportCostEstimate {
  cost: number | null;
  ratePerKm: number | null;
  note?: string;
}

export interface IntercityQuote extends IntercityOption {
  mode: IntercityMode;
}

export interface IntercityEstimate {
  options: IntercityQuote[];
  /** Cheapest option, or the one matching `preferred` when given and priced. */
  recommended: IntercityQuote | null;
  note?: string;
}

function pairKey(fromCity: string, toCity: string): string {
  return [fromCity, toCity].sort().join('-');
}

/**
 * All sourced inter-city options for a city pair, plus a recommendation:
 * the traveler's preferred mode when priced, otherwise the cheapest.
 * Returns an empty option list (never invented figures) for a pair outside
 * the 3-city MVP dataset.
 */
export function estimateIntercityTransport(
  fromCity: string,
  toCity: string,
  preferred: IntercityPreference = 'any',
): IntercityEstimate {
  const table = INTERCITY_OPTIONS[pairKey(fromCity, toCity)];
  if (!table) {
    return { options: [], recommended: null, note: 'Trajet inter-villes non tarifé (hors dataset MVP).' };
  }
  const options: IntercityQuote[] = (Object.entries(table) as Array<[IntercityMode, IntercityOption]>).map(
    ([mode, o]) => ({ mode, ...o }),
  );
  const byCheapest = [...options].sort((a, b) => a.price - b.price);
  const recommended =
    preferred !== 'any' ? (options.find((o) => o.mode === preferred) ?? byCheapest[0]) : byCheapest[0];
  return { options: byCheapest, recommended };
}

/**
 * Legacy single-number contract (still used by the older estimateTransportCost
 * tool and the manual "add transport leg" endpoint): same-city legs keep the
 * per-km rate; inter-city legs now delegate to the sourced table above,
 * picking the cheapest priced option, instead of the old flat guess.
 */
export function estimateTransportCost(fromCity: string, toCity: string, mode: TransportMode): TransportCostEstimate {
  if (fromCity !== toCity) {
    const { recommended, note } = estimateIntercityTransport(fromCity, toCity);
    return { cost: recommended?.price ?? null, ratePerKm: null, note: recommended ? undefined : note };
  }
  return { cost: null, ratePerKm: LOCAL_MAD_PER_KM[mode] ?? null, note: 'Multiplier par la distance (getDistance).' };
}

/** Total local-transport buffer for the whole trip (per-person daily rate × travelers × days). */
export function localTransportMargin(mode: TransportMode | null | undefined, travelers: number, days: number): number {
  const perPersonPerDay = LOCAL_DAILY_TRANSPORT_MARGIN_MAD[mode ?? 'mixed'] ?? LOCAL_DAILY_TRANSPORT_MARGIN_MAD.mixed;
  return Math.round(perPersonPerDay * travelers * days);
}
