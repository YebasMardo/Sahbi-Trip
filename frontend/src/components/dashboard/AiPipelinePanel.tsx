import { Activity, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useAiHealthQuery } from '../../features/trips/trips.apiSlice'
import type { ProviderHealth } from '../../features/trips/trips.types'

const STAGES: Array<{ key: 'llm' | 'embed' | 'rerank'; label: string; role: string }> = [
  { key: 'embed', label: 'Embeddings', role: 'Vectorise la requête et le catalogue' },
  { key: 'rerank', label: 'Reranking', role: 'Reclasse les candidats les plus pertinents' },
  { key: 'llm', label: 'LLM', role: "Construit l'itinéraire via tool calling" },
]

/**
 * Live status of the three AI providers behind the generation pipeline
 * (GET /ai/health). Reports what is actually reachable rather than asserting
 * the stack is up — a provider being down is shown, not hidden.
 */
export default function AiPipelinePanel() {
  // Each check is three live provider calls, one of them an Anthropic
  // completion, so this query opts out of the store's global refetchOnFocus /
  // refetchOnMountOrArgChange — otherwise every tab switch back to the
  // dashboard would spend the same rate-limited token budget a running generation
  // needs. Refreshing is explicit, via the button below.
  const { data, isLoading, error, refetch, isFetching } = useAiHealthQuery(undefined, {
    refetchOnFocus: false,
    refetchOnMountOrArgChange: false,
  })
  const report = data?.data

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
            <Activity size={15} className="text-primary-500" /> Pipeline IA
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Recherche vectorielle, reranking et génération — état des fournisseurs en direct.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="shrink-0 rounded-full bg-cream px-3 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:opacity-60"
        >
          {isFetching ? 'Vérification…' : 'Rafraîchir'}
        </button>
      </div>

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
          <Loader2 size={13} className="animate-spin" /> Vérification des fournisseurs…
        </p>
      ) : error || !report ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-600">
          État indisponible — le backend n'a pas répondu.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {STAGES.map((stage, i) => (
            <StageRow key={stage.key} index={i + 1} label={stage.label} role={stage.role} health={report[stage.key]} />
          ))}
        </div>
      )}
    </div>
  )
}

function StageRow({
  index,
  label,
  role,
  health,
}: {
  index: number
  label: string
  role: string
  health: ProviderHealth
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
        health.ok ? 'border-teal-400/30 bg-teal-50' : 'border-rose-200 bg-rose-50'
      }`}
    >
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white ${
          health.ok ? 'bg-teal-400' : 'bg-rose-400'
        }`}
      >
        {health.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-semibold text-ink">
          {index}. {label}
          <span className="font-mono text-[10px] font-normal text-ink-faint">{health.model}</span>
        </p>
        <p className="truncate text-[11px] text-ink-soft">{health.ok ? role : (health.error ?? 'Injoignable')}</p>
      </div>
      <span className={`shrink-0 text-[11px] font-semibold ${health.ok ? 'text-teal-600' : 'text-rose-500'}`}>
        {health.latencyMs} ms
      </span>
    </div>
  )
}
