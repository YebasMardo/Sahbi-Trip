import { Loader2, MessageCircle, Send, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { errorMessage } from '../QueryState'
import { useChatWithTripMutation } from '../../features/trips/trips.apiSlice'

interface Turn {
  role: 'user' | 'assistant'
  text: string
}

const SUGGESTIONS = [
  'Que puis-je faire de gratuit ce jour-là ?',
  'Ce budget est-il réaliste ?',
  'Propose une alternative moins touristique.',
]

/**
 * Contextual chat over the trip (POST /trips/:id/chat). The backend runs the
 * same tool-calling agent as generation, so answers are grounded in the
 * catalogue and the trip's own budget rather than free-form invention.
 *
 * History is intentionally local: the endpoint is stateless and takes a single
 * message plus server-side trip context, so a reload starts a fresh thread.
 */
export default function TripAssistant({ tripId }: { tripId: string }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [chat, { isLoading }] = useChatWithTripMutation()
  const scrollRef = useRef<HTMLDivElement>(null)

  async function send(message: string) {
    const trimmed = message.trim()
    if (!trimmed || isLoading) return

    setTurns((t) => [...t, { role: 'user', text: trimmed }])
    setDraft('')

    try {
      const result = await chat({ tripId, message: trimmed }).unwrap()
      setTurns((t) => [...t, { role: 'assistant', text: result.data.reply }])
    } catch (e) {
      setTurns((t) => [
        ...t,
        { role: 'assistant', text: errorMessage(e) ?? "L'assistant est indisponible pour le moment." },
      ])
    } finally {
      // Let the new turn paint before scrolling to it.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
        <MessageCircle size={15} className="text-primary-500" /> Assistant de voyage
      </h3>
      <p className="mt-0.5 text-xs text-ink-soft">
        Posez une question sur ce voyage — l'IA répond à partir du catalogue et de votre budget.
      </p>

      {turns.length > 0 && (
        <div ref={scrollRef} className="mt-3 max-h-64 overflow-y-auto pr-1">
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
        <div className="mt-3 flex flex-col gap-1.5">
          {SUGGESTIONS.map((s) => (
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

      <form
        className="mt-3 flex items-center gap-2"
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
  )
}
