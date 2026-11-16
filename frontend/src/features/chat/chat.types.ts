export type ChatContext = 'dashboard' | 'trip' | 'day' | 'activity'

export interface ChatHistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatContextualPayload {
  context: ChatContext
  contextId?: string
  message: string
  history?: ChatHistoryTurn[]
}

export interface ChatContextualResult {
  reply: string
}
