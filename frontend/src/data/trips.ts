/**
 * Trip domain helpers — pure functions over the server's view model.
 *
 * Every trip, day and activity now comes from the backend
 * (`GET /trips/:id/view`, see features/trips/trips.apiSlice.ts). This module
 * holds only presentation-level derivations the UI needs locally: visit
 * progress, time arithmetic for the schedule pickers, and currency/duration
 * formatting. Anything that decides *what is in* a trip — prices, budget
 * totals, day titles, hero images — is computed server-side and must not be
 * recomputed here.
 *
 * Types are re-exported from features/trips/trips.types.ts so components can
 * keep importing the domain model from one place.
 */

import type { ActivityItem, ActivityItemStatus, BudgetCategory, DayPlan, Trip } from '../features/trips/trips.types'

export type {
  ActivityItem,
  ActivityItemKind,
  ActivityItemStatus,
  BudgetCategory,
  BudgetCategoryKey,
  DayPlan,
  PickerKindFilter,
  PickerPlace,
  PlaceImage,
  PriceConfidence,
  Trip,
  TripStatus,
} from '../features/trips/trips.types'

// ============================================================
// Visit status
// ============================================================

export function activityStatus(item: ActivityItem): ActivityItemStatus {
  return item.status ?? 'to_visit'
}

export const ACTIVITY_STATUS_ORDER: ActivityItemStatus[] = ['to_visit', 'confirmed', 'visited', 'missed']

export const ACTIVITY_STATUS_LABELS: Record<ActivityItemStatus, string> = {
  to_visit: 'À visiter',
  confirmed: 'Visite confirmée',
  visited: 'Visité',
  missed: 'Non visité',
}

export const ACTIVITY_STATUS_HINTS: Record<ActivityItemStatus, string> = {
  to_visit: 'Au programme, visite pas encore confirmée.',
  confirmed: 'Vous confirmez que vous irez sur place.',
  visited: 'Vous y êtes allé·e.',
  missed: "Vous n'avez pas pu y aller.",
}

// ============================================================
// Visit progress — per day and for the whole trip
// ============================================================

export interface VisitProgress {
  total: number
  toVisit: number
  confirmed: number
  visited: number
  missed: number
  /** Share of activities actually visited. Drives the progress bar. */
  percentVisited: number
  /** Share of activities the traveler has settled (visited or missed). */
  percentResolved: number
}

export function progressFor(activities: ActivityItem[]): VisitProgress {
  const total = activities.length
  const count = (s: ActivityItemStatus) => activities.filter((a) => activityStatus(a) === s).length
  const visited = count('visited')
  const missed = count('missed')
  return {
    total,
    toVisit: count('to_visit'),
    confirmed: count('confirmed'),
    visited,
    missed,
    percentVisited: total === 0 ? 0 : Math.round((visited / total) * 100),
    percentResolved: total === 0 ? 0 : Math.round(((visited + missed) / total) * 100),
  }
}

export function dayProgress(day: DayPlan): VisitProgress {
  return progressFor(day.activities)
}

export function tripProgress(trip: Trip): VisitProgress {
  return progressFor(trip.days.flatMap((d) => d.activities))
}

/** Days where every activity has been settled (visited or missed). */
export function daysCompleted(trip: Trip): number {
  return trip.days.filter((d) => d.activities.length > 0 && dayProgress(d).percentResolved === 100).length
}

// ============================================================
// Time helpers — the planner works in "HH:MM" strings
// ============================================================

export const DAY_WINDOW_START = '07:00'
export const DAY_WINDOW_END = '23:00'

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutes(hhmm: string, minutes: number): string {
  return minutesToTime(timeToMinutes(hhmm) + minutes)
}

export function durationBetween(startTime: string, endTime: string): number {
  return Math.max(timeToMinutes(endTime) - timeToMinutes(startTime), 0)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function sortByStartTime(activities: ActivityItem[]): ActivityItem[] {
  return [...activities].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
}

/** First activity whose slot overlaps [startTime, endTime), ignoring `ignoreId`. */
export function findTimeConflict(
  activities: ActivityItem[],
  startTime: string,
  endTime: string,
  ignoreId?: string,
): ActivityItem | null {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  return (
    activities.find(
      (a) => a.id !== ignoreId && start < timeToMinutes(a.endTime) && timeToMinutes(a.startTime) < end,
    ) ?? null
  )
}

/**
 * First free slot of `durationMin` inside the day window, after the existing
 * activities. Falls back to the end of the day when nothing fits.
 */
export function suggestSlot(
  activities: ActivityItem[],
  durationMin: number,
): { startTime: string; endTime: string } {
  const windowStart = timeToMinutes(DAY_WINDOW_START)
  const windowEnd = timeToMinutes(DAY_WINDOW_END)
  const busy = sortByStartTime(activities).map((a) => ({
    start: timeToMinutes(a.startTime),
    end: timeToMinutes(a.endTime),
  }))

  let cursor = windowStart
  for (const slot of busy) {
    if (slot.start - cursor >= durationMin) break
    cursor = Math.max(cursor, slot.end)
  }
  if (cursor + durationMin > windowEnd) {
    cursor = Math.max(windowStart, windowEnd - durationMin)
  }
  return { startTime: minutesToTime(cursor), endTime: minutesToTime(cursor + durationMin) }
}

// ============================================================
// Formatting
// ============================================================

export function formatMAD(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} MAD`
}

export function budgetPercentages(categories: BudgetCategory[]): Array<BudgetCategory & { pct: number }> {
  const total = categories.reduce((s, c) => s + c.amount, 0)
  if (total === 0) return categories.map((c) => ({ ...c, pct: 0 }))
  return categories.map((c) => ({ ...c, pct: Math.round((c.amount / total) * 100) }))
}

/** Per-person day cost, summing the prices the backend already divided by travelers. */
export function dayBudget(day: DayPlan): number {
  return day.activities.reduce((sum, item) => sum + (item.price ?? 0), 0)
}

/** Names already booked in a day — used to keep the picker from offering duplicates. */
export function dayActivityNames(day: DayPlan): string[] {
  return day.activities.map((a) => a.name)
}

// ============================================================
// Cross-trip aggregates — dashboard overview
// ============================================================

export interface CityActivityCount {
  city: string
  count: number
}

/** Planned activities per destination, across every trip, richest first. */
export function activitiesByCity(trips: Trip[]): CityActivityCount[] {
  const counts = new Map<string, number>()
  for (const trip of trips) {
    for (const day of trip.days) {
      counts.set(day.city, (counts.get(day.city) ?? 0) + day.activities.length)
    }
  }
  return [...counts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
}

/** Distinct destinations across every trip. */
export function citiesExplored(trips: Trip[]): number {
  const cities = new Set<string>()
  for (const trip of trips) for (const day of trip.days) cities.add(day.city)
  return cities.size
}

/**
 * Per-person budget categories, summed across every trip — the categories
 * themselves (key/label/color) are already consistent across trips (see
 * TripViewService), so amounts for the same key just add up.
 */
export function aggregateBudgetCategories(trips: Trip[]): Array<BudgetCategory & { pct: number }> {
  const byKey = new Map<string, BudgetCategory>()
  for (const trip of trips) {
    for (const cat of trip.budgetCategories) {
      const existing = byKey.get(cat.key)
      if (existing) existing.amount += cat.amount
      else byKey.set(cat.key, { ...cat })
    }
  }
  return budgetPercentages([...byKey.values()])
}
