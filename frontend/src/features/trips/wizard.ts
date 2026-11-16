/**
 * Trip wizard form state and its mapping onto the backend's `CreateTripDto`.
 *
 * Every option value below is the exact enum value the backend validates
 * against (`backend/src/app/trips/schemas/trip.schema.ts`) — the French text is
 * only a label. Interests use the keys `ScoringService.INTEREST_TO_CATEGORIES`
 * understands, so what the traveler picks here actually steers retrieval and
 * scoring rather than being cosmetic.
 */

import type {
  ComfortLevel,
  CreateTripPayload,
  IntercityTransportMode,
  Pace,
  TransportMode,
  TravelerType,
  TripProfile,
} from './trips.types'

/** Cities covered by the MVP dataset (data/morocco_dataset.json meta.cities). */
export const AVAILABLE_CITIES = ['Marrakech', 'Casablanca', 'Rabat'] as const
export type CityName = (typeof AVAILABLE_CITIES)[number]

export const INTEREST_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'culture', label: 'Culture' },
  { value: 'histoire', label: 'Histoire' },
  { value: 'gastronomie', label: 'Gastronomie' },
  { value: 'nature', label: 'Nature' },
  { value: 'plage', label: 'Plage' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'famille', label: 'Famille' },
  { value: 'aventure', label: 'Aventure' },
  { value: 'vie_nocturne', label: 'Vie nocturne' },
  { value: 'artisanat', label: 'Artisanat & souks' },
  { value: 'panoramas', label: 'Panoramas & couchers de soleil' },
  { value: 'bien_etre', label: 'Bien-être & détente' },
  { value: 'art', label: 'Art & musées' },
]

export const PACE_OPTIONS: Array<{ value: Pace; label: string; hint: string }> = [
  { value: 'relaxed', label: 'Détendu', hint: '2-3 activités / jour' },
  { value: 'balanced', label: 'Équilibré', hint: '3-4 activités / jour' },
  { value: 'intense', label: 'Intense', hint: '5+ activités / jour' },
]

export const DIETARY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'vegetarien', label: 'Végétarien' },
  { value: 'vegan', label: 'Végan' },
  { value: 'sans_gluten', label: 'Sans gluten' },
  { value: 'halal_uniquement', label: 'Halal uniquement' },
]

export const TRAVELER_TYPES: Array<{ value: TravelerType; label: string }> = [
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Famille' },
  { value: 'group', label: 'Groupe' },
]

export const COMFORT_LEVELS: Array<{ value: ComfortLevel; label: string }> = [
  { value: 'budget', label: 'Économique' },
  { value: 'mid-range', label: 'Confort moyen' },
  { value: 'luxury', label: 'Haut confort' },
]

export const TRANSPORT_MODES: Array<{ value: TransportMode; label: string }> = [
  { value: 'walk', label: 'À pied' },
  { value: 'public', label: 'Transports en commun' },
  { value: 'car', label: 'Voiture' },
  { value: 'mixed', label: 'Mixte' },
]

/** Preferred carrier between cities — only shown/sent when 2+ cities are selected. */
export const INTERCITY_TRANSPORT_MODES: Array<{ value: IntercityTransportMode; label: string; hint: string }> = [
  { value: 'any', label: 'Peu importe', hint: "L'IA choisit l'option la moins chère" },
  { value: 'train', label: 'Train', hint: 'ONCF — le plus confortable' },
  { value: 'bus', label: 'Bus', hint: 'CTM — souvent le moins cher' },
  { value: 'taxi', label: 'Taxi partagé', hint: 'Grand taxi — le plus direct' },
]

/** The backend's marker for "keep me away from the crowds" (ScoringService touristFit). */
export const AVOID_TOURISTY = 'overly_touristic'

/**
 * The extractor is an LLM, so it returns whatever word the traveler used —
 * `food` for gastronomie, `history` for histoire. Mapping those onto our option
 * values keeps a correctly-understood interest from being silently dropped by
 * `applyProfile`'s unknown-value filter.
 */
const INTEREST_ALIASES: Record<string, string> = {
  food: 'gastronomie',
  gastronomy: 'gastronomie',
  cuisine: 'gastronomie',
  history: 'histoire',
  historical: 'histoire',
  beach: 'plage',
  sea: 'plage',
  nature: 'nature',
  shopping: 'shopping',
  souk: 'shopping',
  souks: 'shopping',
  family: 'famille',
  kids: 'famille',
  adventure: 'aventure',
  nightlife: 'vie_nocturne',
  vie_nocturne: 'vie_nocturne',
  culture: 'culture',
  cultural: 'culture',
  museum: 'art',
  museums: 'art',
  art: 'art',
  crafts: 'artisanat',
  handicrafts: 'artisanat',
  artisanat: 'artisanat',
  souvenirs: 'artisanat',
  panorama: 'panoramas',
  panoramas: 'panoramas',
  viewpoint: 'panoramas',
  sunset: 'panoramas',
  wellness: 'bien_etre',
  relaxation: 'bien_etre',
  spa: 'bien_etre',
  hammam: 'bien_etre',
  bien_etre: 'bien_etre',
}

function normalizeInterest(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_')
  return INTEREST_ALIASES[key] ?? key
}

export interface WizardFormState {
  mode: 'guided' | 'freeText'
  freeText: string
  customTitle: string
  cities: CityName[]
  startDate: string
  durationDays: number
  travelers: number
  travelerType: TravelerType
  budgetTotal: number
  budgetLodging: number | null
  budgetActivities: number | null
  interests: string[]
  comfort: ComfortLevel
  transport: TransportMode
  /** Days per city, keyed by city name — only meaningful with 2+ cities (see resolvedCityDays). */
  cityDays: Record<string, number>
  intercityTransport: IntercityTransportMode
  avoidTouristy: boolean
  alreadyInMorocco: boolean
  currentCity: string
  pace: Pace
  dietary: string[]
  travelNotes: string
}

export function defaultWizardState(): WizardFormState {
  return {
    mode: 'guided',
    freeText: '',
    customTitle: '',
    cities: ['Marrakech'],
    startDate: inThirtyDays(),
    durationDays: 4,
    travelers: 2,
    travelerType: 'couple',
    budgetTotal: 4000,
    budgetLodging: null,
    budgetActivities: null,
    interests: ['culture', 'gastronomie'],
    comfort: 'mid-range',
    transport: 'walk',
    cityDays: {},
    intercityTransport: 'any',
    avoidTouristy: false,
    alreadyInMorocco: false,
    currentCity: '',
    pace: 'balanced',
    dietary: [],
    travelNotes: '',
  }
}

function inThirtyDays(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

export function interestLabel(value: string): string {
  return INTEREST_OPTIONS.find((i) => i.value === value)?.label ?? value.replace(/_/g, ' ')
}

export function defaultTripTitle(form: WizardFormState): string {
  const primary = form.cities[0] ?? 'Marrakech'
  if (form.cities.length > 1) return `Mon voyage au Maroc — ${form.cities.join(' · ')}`
  return `Mon voyage à ${primary}`
}

/** Inclusive end date: a 1-day trip starts and ends the same day. */
export function endDateFor(startDate: string, durationDays: number): string {
  const d = new Date(startDate)
  d.setDate(d.getDate() + Math.max(durationDays - 1, 0))
  return d.toISOString().slice(0, 10)
}

/** Even split of `totalDays` across `cities`, remainder going to the first ones. */
export function distributeDays(cities: string[], totalDays: number): Record<string, number> {
  if (cities.length === 0) return {}
  const base = Math.floor(totalDays / cities.length)
  const remainder = totalDays - base * cities.length
  const result: Record<string, number> = {}
  cities.forEach((c, i) => {
    result[c] = base + (i < remainder ? 1 : 0)
  })
  return result
}

/**
 * The day allocation actually used — the traveler's edits when they add up to
 * `durationDays`, otherwise a fresh even split. Single-city trips don't need
 * one at all.
 */
export function resolvedCityDays(form: WizardFormState): Record<string, number> {
  if (form.cities.length <= 1) return {}
  const complete = form.cities.every((c) => form.cityDays[c] != null)
  const sum = form.cities.reduce((s, c) => s + (form.cityDays[c] ?? 0), 0)
  if (complete && sum === form.durationDays) return form.cityDays
  return distributeDays(form.cities, form.durationDays)
}

/** Whether the traveler's manual per-city allocation is ready to submit. */
export function cityDaysValid(form: WizardFormState): boolean {
  if (form.cities.length <= 1) return true
  const sum = form.cities.reduce((s, c) => s + (form.cityDays[c] ?? 0), 0)
  return sum === form.durationDays && form.cities.every((c) => (form.cityDays[c] ?? 0) >= 1)
}

export function toCreateTripPayload(form: WizardFormState): CreateTripPayload {
  return {
    title: form.customTitle.trim() || defaultTripTitle(form),
    startDate: form.startDate,
    endDate: endDateFor(form.startDate, form.durationDays),
    durationDays: form.durationDays,
    travelers: form.travelers,
    budgetTotal: form.budgetTotal,
    ...(form.budgetLodging !== null && { budgetAccommodation: form.budgetLodging }),
    ...(form.budgetActivities !== null && { budgetActivities: form.budgetActivities }),
    currency: 'MAD',
    cities: form.cities,
    interests: form.interests,
    avoid: form.avoidTouristy ? [AVOID_TOURISTY] : [],
    comfort: form.comfort,
    transport: form.transport,
    ...(form.cities.length > 1 && {
      cityDurations: form.cities.map((city) => ({ city, days: resolvedCityDays(form)[city] })),
      intercityTransport: form.intercityTransport,
    }),
    travelerType: form.travelerType,
    alreadyInMorocco: form.alreadyInMorocco,
    ...(form.alreadyInMorocco && form.currentCity.trim() && { currentCity: form.currentCity.trim() }),
    pace: form.pace,
    dietary: form.dietary,
    ...(form.travelNotes.trim() && { travelNotes: form.travelNotes.trim() }),
    language: 'fr',
  }
}

/**
 * Folds an AI-extracted profile into the form so the traveler reviews and
 * corrects it before anything is created. Absent fields are left alone rather
 * than zeroed — the extractor returns `null` for "not stated in the text",
 * which must not wipe a sensible default.
 */
export function applyProfile(form: WizardFormState, profile: TripProfile): WizardFormState {
  const cities = profile.cities.filter((c): c is CityName =>
    (AVAILABLE_CITIES as readonly string[]).includes(c),
  )
  const known = new Set(INTEREST_OPTIONS.map((i) => i.value))
  const interests = [...new Set(profile.interests.map(normalizeInterest).filter((i) => known.has(i)))]
  const resolvedCities = cities.length ? cities : form.cities
  const resolvedDuration = profile.durationDays ?? form.durationDays

  return {
    ...form,
    cities: resolvedCities,
    startDate: profile.startDate ?? form.startDate,
    durationDays: resolvedDuration,
    // Free-text jumps straight to the recap step, so seed a default even
    // split now — the traveler can still fine-tune it there.
    cityDays: resolvedCities.length > 1 ? distributeDays(resolvedCities, resolvedDuration) : form.cityDays,
    travelers: profile.travelers || form.travelers,
    budgetTotal: profile.budgetTotal || form.budgetTotal,
    budgetLodging: profile.budgetAccommodation ?? form.budgetLodging,
    budgetActivities: profile.budgetActivities ?? form.budgetActivities,
    interests: interests.length ? interests : form.interests,
    comfort: isComfort(profile.comfort) ? profile.comfort : form.comfort,
    transport: isTransport(profile.transport) ? profile.transport : form.transport,
    travelerType: isTravelerType(profile.travelerType) ? profile.travelerType : form.travelerType,
    avoidTouristy: profile.avoid.includes(AVOID_TOURISTY) || form.avoidTouristy,
    alreadyInMorocco: profile.alreadyInMorocco,
    currentCity: profile.currentCity ?? form.currentCity,
    pace: isPace(profile.pace) ? profile.pace : form.pace,
    dietary: profile.dietary?.length ? profile.dietary : form.dietary,
    travelNotes: profile.travelNotes ?? form.travelNotes,
  }
}

function isComfort(value: unknown): value is ComfortLevel {
  return COMFORT_LEVELS.some((c) => c.value === value)
}

function isTransport(value: unknown): value is TransportMode {
  return TRANSPORT_MODES.some((t) => t.value === value)
}

function isTravelerType(value: unknown): value is TravelerType {
  return TRAVELER_TYPES.some((t) => t.value === value)
}

function isPace(value: unknown): value is Pace {
  return PACE_OPTIONS.some((p) => p.value === value)
}
