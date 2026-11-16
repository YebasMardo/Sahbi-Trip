import { createApi } from '@reduxjs/toolkit/query/react'

import { baseQueryWithReauth } from './customBaseQuery'

/** Mirrors `backend/src/core/httpResponse/SuccessResponse.ts`. */
export interface ApiResponse<T> {
  status: string
  message?: string
  data: T
}

export const apiSlice = createApi({
  reducerPath: 'api',
  refetchOnMountOrArgChange: true,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ['Me', 'Trips', 'Trip', 'DashboardStatus', 'Catalogue'],
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
})
