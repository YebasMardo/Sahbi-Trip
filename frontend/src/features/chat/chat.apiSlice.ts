import { apiSlice } from '../../store/apiSlice'
import type { ApiResponse } from '../../store/apiSlice'
import type { ChatContextualPayload, ChatContextualResult } from './chat.types'

// Backend: backend/src/app/trips/contextual-chat.controller.ts (POST /chat/contextual).
// Stateless — no cache tags, no invalidation, nothing else in the app depends on it.
const chatApiSlice = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    chatContextual: build.mutation<ApiResponse<ChatContextualResult>, ChatContextualPayload>({
      query: (body) => ({ url: '/chat/contextual', method: 'POST', body }),
    }),
  }),
})

export const { useChatContextualMutation } = chatApiSlice

export default chatApiSlice
