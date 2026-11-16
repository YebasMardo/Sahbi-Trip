import { apiSlice } from '../../store/apiSlice'
import type { ApiResponse } from '../../store/apiSlice'
import type {
  ActivitiesQuery,
  ActivityStats,
  AddActivityPayload,
  AddTransportLegPayload,
  AiHealthReport,
  CatalogueActivity,
  CatalogueRestaurant,
  ChatResult,
  CreateTripPayload,
  DashboardStatus,
  DeleteActivityPayload,
  OptimizeResult,
  Paginated,
  ReplaceAlternative,
  RestaurantStats,
  RestaurantsQuery,
  Trip,
  TripProfile,
  TripRecord,
  UpdateActivityPayload,
} from './trips.types'

/**
 * Endpoint paths and payload shapes mirror `backend/src/app/trips/trips.controller.ts`,
 * `activities.controller.ts`, `restaurants.controller.ts` and `ai.controller.ts`.
 *
 * Cache strategy: every mutation that touches a trip's itinerary invalidates
 * that trip's `Trip` tag plus the `Trips` list tag. The backend recomputes the
 * whole view (budget totals, day tags, hero images, progress) on each read, so
 * refetching the view after a write is what keeps those derived numbers honest
 * — there is no client-side recomputation to keep in sync.
 */
const tripsApiSlice = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    // ── Reads ────────────────────────────────────────────────────────
    listTrips: build.query<ApiResponse<Trip[]>, void>({
      query: () => ({ url: '/trips', method: 'GET' }),
      providesTags: [{ type: 'Trips', id: 'LIST' }],
    }),

    // The denormalized view — what every trip screen renders from. Works on a
    // draft too: the backend previews `proposedItinerary` when no TripActivity
    // rows exist yet.
    getTripView: build.query<ApiResponse<Trip>, string>({
      query: (tripId) => ({ url: `/trips/${tripId}/view`, method: 'GET' }),
      providesTags: (_result, _error, tripId) => [{ type: 'Trip', id: tripId }],
    }),

    getDashboardStatus: build.query<ApiResponse<DashboardStatus>, string>({
      query: (tripId) => ({ url: `/trips/${tripId}/dashboard-status`, method: 'GET' }),
      providesTags: (_result, _error, tripId) => [{ type: 'DashboardStatus', id: tripId }],
    }),

    // ── Trip lifecycle ───────────────────────────────────────────────
    createTrip: build.mutation<ApiResponse<TripRecord>, CreateTripPayload>({
      query: (body) => ({ url: '/trips', method: 'POST', body }),
      invalidatesTags: [{ type: 'Trips', id: 'LIST' }],
    }),

    // Runs the full AI pipeline (retrieval → rerank → scoring → LLM + tools).
    // Slow by nature — callers should show progress rather than a spinner.
    generateTrip: build.mutation<ApiResponse<TripRecord>, string>({
      query: (tripId) => ({ url: `/trips/${tripId}/generate`, method: 'POST' }),
      invalidatesTags: (_result, _error, tripId) => [
        { type: 'Trip', id: tripId },
        { type: 'Trips', id: 'LIST' },
      ],
    }),

    // Freezes the proposal into TripActivity rows, then fills the dashboard.
    confirmTrip: build.mutation<ApiResponse<TripRecord>, string>({
      query: (tripId) => ({ url: `/trips/${tripId}/confirm`, method: 'POST' }),
      invalidatesTags: (_result, _error, tripId) => [
        { type: 'Trip', id: tripId },
        { type: 'Trips', id: 'LIST' },
        { type: 'DashboardStatus', id: tripId },
      ],
    }),

    // ── Itinerary edits ──────────────────────────────────────────────
    addTripActivity: build.mutation<ApiResponse<unknown>, AddActivityPayload>({
      query: ({ tripId, ...body }) => ({ url: `/trips/${tripId}/activities`, method: 'POST', body }),
      invalidatesTags: (_result, _error, { tripId }) => [
        { type: 'Trip', id: tripId },
        { type: 'Trips', id: 'LIST' },
      ],
    }),

    addTransportLeg: build.mutation<ApiResponse<unknown>, AddTransportLegPayload>({
      query: ({ tripId, ...body }) => ({
        url: `/trips/${tripId}/activities/transport`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { tripId }) => [
        { type: 'Trip', id: tripId },
        { type: 'Trips', id: 'LIST' },
      ],
    }),

    // Covers reschedule, status change and place swap — all one PATCH.
    updateTripActivity: build.mutation<ApiResponse<unknown>, UpdateActivityPayload>({
      query: ({ tripId, taId, ...body }) => ({
        url: `/trips/${tripId}/activities/${taId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { tripId }) => [
        { type: 'Trip', id: tripId },
        { type: 'Trips', id: 'LIST' },
      ],
    }),

    deleteTripActivity: build.mutation<ApiResponse<unknown>, DeleteActivityPayload>({
      query: ({ tripId, taId }) => ({ url: `/trips/${tripId}/activities/${taId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { tripId }) => [
        { type: 'Trip', id: tripId },
        { type: 'Trips', id: 'LIST' },
      ],
    }),

    // ── AI actions ───────────────────────────────────────────────────
    // Free text (FR/EN/AR/Darija) → structured profile, used to pre-fill the wizard.
    extractProfile: build.mutation<ApiResponse<TripProfile>, string>({
      query: (text) => ({ url: '/trips/extract-profile', method: 'POST', body: { text } }),
    }),

    // Proposes 3 alternatives — read-only, does NOT mutate the itinerary. The
    // caller applies one via updateTripActivity.
    replaceActivity: build.mutation<
      ApiResponse<{ alternatives: ReplaceAlternative[] }>,
      { tripId: string; taId: string }
    >({
      query: ({ tripId, taId }) => ({
        url: `/trips/${tripId}/activities/${taId}/replace`,
        method: 'POST',
      }),
    }),

    // Reorders a day (or the whole trip) to cut travel time, and persists the
    // new start times server-side.
    optimizeTrip: build.mutation<ApiResponse<OptimizeResult>, { tripId: string; day?: number }>({
      query: ({ tripId, day }) => ({
        url: `/trips/${tripId}/optimize`,
        method: 'POST',
        body: day ? { day } : {},
      }),
      invalidatesTags: (_result, _error, { tripId }) => [
        { type: 'Trip', id: tripId },
        { type: 'Trips', id: 'LIST' },
      ],
    }),

    // Re-runs generation under a tighter budget. Draft-only server-side.
    adaptBudget: build.mutation<ApiResponse<TripRecord>, { tripId: string; remaining: number }>({
      query: ({ tripId, remaining }) => ({
        url: `/trips/${tripId}/adapt-budget`,
        method: 'POST',
        body: { remaining },
      }),
      invalidatesTags: (_result, _error, { tripId }) => [
        { type: 'Trip', id: tripId },
        { type: 'Trips', id: 'LIST' },
      ],
    }),

    chatWithTrip: build.mutation<ApiResponse<ChatResult>, { tripId: string; message: string }>({
      query: ({ tripId, message }) => ({
        url: `/trips/${tripId}/chat`,
        method: 'POST',
        body: { message },
      }),
    }),

    // ── Catalogue (public) ───────────────────────────────────────────
    listActivities: build.query<ApiResponse<Paginated<CatalogueActivity>>, ActivitiesQuery>({
      query: (params) => ({ url: '/activities', method: 'GET', params: compact(params) }),
      providesTags: [{ type: 'Catalogue', id: 'ACTIVITIES' }],
    }),

    getActivity: build.query<ApiResponse<CatalogueActivity>, string>({
      query: (id) => ({ url: `/activities/${id}`, method: 'GET' }),
      providesTags: (_r, _e, id) => [{ type: 'Catalogue', id }],
    }),

    // Per-city coverage counts, for the landing page. One grouped query each
    // rather than a count request per city.
    activityStats: build.query<ApiResponse<ActivityStats>, void>({
      query: () => ({ url: '/activities/stats', method: 'GET' }),
      providesTags: [{ type: 'Catalogue', id: 'ACTIVITY_STATS' }],
    }),

    restaurantStats: build.query<ApiResponse<RestaurantStats>, void>({
      query: () => ({ url: '/restaurants/stats', method: 'GET' }),
      providesTags: [{ type: 'Catalogue', id: 'RESTAURANT_STATS' }],
    }),

    listRestaurants: build.query<ApiResponse<Paginated<CatalogueRestaurant>>, RestaurantsQuery>({
      query: (params) => ({ url: '/restaurants', method: 'GET', params: compact(params) }),
      providesTags: [{ type: 'Catalogue', id: 'RESTAURANTS' }],
    }),

    getRestaurant: build.query<ApiResponse<CatalogueRestaurant>, string>({
      query: (id) => ({ url: `/restaurants/${id}`, method: 'GET' }),
      providesTags: (_r, _e, id) => [{ type: 'Catalogue', id }],
    }),

    // ── AI provider health (public, for the pipeline panel) ──────────
    // Every call is three real provider round trips, one of them an Anthropic
    // completion. The panel's hook therefore opts out of the store's global
    // refetchOnFocus/refetchOnMountOrArgChange (those are hook-level options,
    // not endpoint-level — see AiPipelinePanel): left on, a tab switch would
    // spend the same per-minute token quota a running generation needs. The
    // cached window below, plus the panel's refresh button, is the re-probe path.
    aiHealth: build.query<ApiResponse<AiHealthReport>, void>({
      query: () => ({ url: '/ai/health', method: 'GET' }),
      keepUnusedDataFor: 60,
    }),
  }),
})

/**
 * Drops undefined/empty values so they never reach the query string — the
 * backend's DTOs validate what they receive, and `?city=` (empty) fails
 * `@IsString()` where an absent key is simply optional.
 */
function compact(params: object): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = value as string | number | boolean
  }
  return out
}

export const {
  useListTripsQuery,
  useGetTripViewQuery,
  useGetDashboardStatusQuery,
  useCreateTripMutation,
  useGenerateTripMutation,
  useConfirmTripMutation,
  useAddTripActivityMutation,
  useAddTransportLegMutation,
  useUpdateTripActivityMutation,
  useDeleteTripActivityMutation,
  useExtractProfileMutation,
  useReplaceActivityMutation,
  useOptimizeTripMutation,
  useAdaptBudgetMutation,
  useChatWithTripMutation,
  useListActivitiesQuery,
  useGetActivityQuery,
  useListRestaurantsQuery,
  useGetRestaurantQuery,
  useActivityStatsQuery,
  useRestaurantStatsQuery,
  useAiHealthQuery,
} = tripsApiSlice

export default tripsApiSlice
