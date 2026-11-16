import { Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { errorMessage } from '../QueryState'
import { useChatContextualMutation } from '../../features/chat/chat.apiSlice'
import type { ChatContext, ChatHistoryTurn } from '../../features/chat/chat.types'

interface Turn {
  role: 'user' | 'assistant'
  text: string
}

const SUGGESTIONS: Record<ChatContext, string[]> = {
  dashboard: ['Comment créer un voyage ?', 'Que puis-je personnaliser ?'],
  trip: ['Où en est mon budget ?', "Que faire si un jour de mon voyage pose problème ?"],
  day: ['Cette journée est-elle trop chargée ?', 'Quel est le coût total de cette journée ?'],
  activity: ["Quels sont les horaires d'ouverture ?", 'Est-ce adapté aux enfants ?'],
}

const TITLES: Record<ChatContext, string> = {
  dashboard: 'Assistant Sahbi Trip',
  trip: 'Assistant de voyage',
  day: 'Assistant — cette journée',
  activity: 'Assistant — ce lieu',
}

/**
 * Detects the current page context purely from the route params already
 * defined in main.tsx (:tripId / :dayId / :activityId) — no second routing
 * mechanism, no extra data fetching. `contextId` encoding matches what
 * ContextualChatService expects on the backend.
 */
function useChatContext(): { context: ChatContext; contextId?: string } {
  const { tripId, dayId, activityId } = useParams()
  if (tripId && activityId) return { context: 'activity', contextId: `${tripId}:${activityId}` }
  if (tripId && dayId) return { context: 'day', contextId: `${tripId}:${dayId}` }
  if (tripId) return { context: 'trip', contextId: tripId }
  return { context: 'dashboard' }
}

export default function FloatingChatWidget() {
  const { context, contextId } = useChatContext()
  const [isOpen, setIsOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [chat, { isLoading }] = useChatContextualMutation()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Switching context (navigating to a different trip/day/activity, or back
  // to the dashboard) starts a fresh, unrelated conversation.
  useEffect(() => {
    setTurns([])
    setDraft('')
  }, [context, contextId])

  async function send(message: string) {
    const trimmed = message.trim()
    if (!trimmed || isLoading) return

    const history: ChatHistoryTurn[] = turns.slice(-6).map((t) => ({ role: t.role, content: t.text }))
    setTurns((t) => [...t, { role: 'user', text: trimmed }])
    setDraft('')

    try {
      const result = await chat({ context, contextId, message: trimmed, history }).unwrap()
      setTurns((t) => [...t, { role: 'assistant', text: result.data.reply }])
    } catch (e) {
      setTurns((t) => [
        ...t,
        { role: 'assistant', text: errorMessage(e) ?? 'Assistant indisponible, réessayez.' },
      ])
    } finally {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-card-lg ring-1 ring-ink/10">
          <div className="flex items-center justify-between border-b border-ink/5 px-4 py-3">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <MessageCircle size={15} className="text-primary-500" /> {TITLES[context]}
            </h3>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setIsOpen(false)}
              className="grid size-7 place-items-center rounded-full text-ink-faint transition-colors hover:bg-cream hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex max-h-[26rem] flex-col overflow-hidden px-4 py-3">
            {turns.length > 0 && (
              <div ref={scrollRef} className="max-h-72 overflow-y-auto pr-1">
                <div className="flex flex-col gap-2">
                  {turns.map((turn, i) => (
                    <div
                      key={i}
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        turn.role === 'user'
                          ? 'self-end bg-primary-500 text-white'
                          : 'self-start bg-cream text-ink-soft'
                      }`}
                    >
                      {turn.text}
                    </div>
                  ))}
                  {isLoading && (
                    <span className="flex items-center gap-1.5 self-start rounded-2xl bg-cream px-3.5 py-2 text-xs text-ink-faint">
                      <Loader2 size={12} className="animate-spin" /> L'assistant réfléchit…
                    </span>
                  )}
                </div>
              </div>
            )}

            {turns.length === 0 && (
              <div className="flex flex-col gap-1.5">
                {SUGGESTIONS[context].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-cream px-3 py-2 text-left text-[11px] font-medium text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:opacity-60"
                  >
                    <Sparkles size={11} /> {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-ink/5 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send(draft)
            }}
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Votre question…"
              className="min-w-0 flex-1 rounded-full border border-ink/10 bg-cream px-3.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-primary-400 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !draft.trim()}
              aria-label="Envoyer"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:opacity-40"
            >
              {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        aria-label={isOpen ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        onClick={() => setIsOpen((v) => !v)}
        className="grid size-14 place-items-center rounded-full bg-primary-500 text-white shadow-card-lg transition-colors hover:bg-primary-600"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  )
}
