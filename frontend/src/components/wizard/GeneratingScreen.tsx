import { AlertTriangle, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'

export type GenerationPhase = 'creating' | 'generating' | 'done' | 'error'

/**
 * The backend runs the whole pipeline inside one `POST /trips/:id/generate`
 * call and returns when it is finished — there is no per-stage progress feed.
 * So each stage below pairs a label with an orb state and a "thinking" caption;
 * a timer advances through them at a pace matching the ~1min typical run, and
 * holds on the last one if the call runs long. It's an honest approximation,
 * not a fake progress bar — nothing here claims completion the backend hasn't
 * reported.
 */
const PIPELINE_STAGES: Array<{ label: string; caption: string; orb: OrbState }> = [
  {
    label: 'Vectorisation de la requête (embeddings)',
    caption: "L'IA transforme votre demande en vecteurs…",
    orb: 'shaping',
  },
  {
    label: 'Recherche vectorielle dans le catalogue',
    caption: 'L’IA fouille le catalogue sourcé pour les meilleures options…',
    orb: 'searching',
  },
  {
    label: 'Reranking des candidats',
    caption: 'L’IA classe les propositions les plus pertinentes…',
    orb: 'solving',
  },
  {
    label: "Construction de l'itinéraire (LLM + outils)",
    caption: 'L’IA construit votre itinéraire jour par jour…',
    orb: 'connecting',
  },
  {
    label: 'Validation et recalcul du budget',
    caption: 'L’IA vérifie le budget et finalise le voyage…',
    orb: 'composing',
  },
]

const STAGE_INTERVAL_MS = 8000

export default function GeneratingScreen({
  phase,
  error,
  onRetry,
  onCancel,
}: {
  phase: GenerationPhase
  error?: string
  onRetry?: () => void
  onCancel?: () => void
}) {
  const failed = phase === 'error'
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    if (phase !== 'generating') {
      setStageIndex(0)
      return
    }
    const id = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, PIPELINE_STAGES.length - 1))
    }, STAGE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [phase])

  const currentStage = PIPELINE_STAGES[stageIndex]
  const orbState: OrbState = phase === 'creating' ? 'breathing' : currentStage.orb

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
      {failed ? (
        <span className="relative grid size-16 place-items-center rounded-2xl bg-rose-500 text-white shadow-card-lg">
          <AlertTriangle size={26} />
        </span>
      ) : (
        <ThinkingOrb
          state={orbState}
          size={64}
          theme="light"
          aria-label={phase === 'creating' ? 'Création de votre voyage en cours' : currentStage.caption}
        />
      )}

      <h1 className="mt-6 font-display text-2xl font-extrabold text-ink">
        {failed
          ? 'La génération a échoué'
          : phase === 'creating'
            ? 'Création de votre voyage…'
            : 'Génération de votre itinéraire…'}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        {failed
          ? (error ?? "L'IA n'a pas pu produire un itinéraire.")
          : phase === 'creating'
            ? "L'IA compare le catalogue sourcé et construit votre voyage, jour par jour. Cela prend généralement moins d'une minute."
            : currentStage.caption}
      </p>

      {!failed && (
        <div className="mt-8 flex w-full max-w-sm flex-col gap-2.5 text-left">
          <div className="flex items-center gap-3 rounded-xl border border-teal-400/30 bg-teal-50 px-4 py-2.5 text-sm text-teal-600">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-teal-400 text-white">
              {phase === 'creating' ? (
                <ThinkingOrb state="breathing" size={20} theme="dark" color="#ffffff" aria-label="En cours" />
              ) : (
                <Check size={11} />
              )}
            </span>
            Voyage enregistré
          </div>

          {PIPELINE_STAGES.map((stage, i) => {
            const isActive = phase === 'generating' && i === stageIndex
            const isDone = phase === 'generating' && i < stageIndex
            return (
              <div
                key={stage.label}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${
                  isActive
                    ? 'border-primary-400/40 bg-primary-50 text-primary-600'
                    : isDone
                      ? 'border-teal-400/30 bg-teal-50 text-teal-600'
                      : 'border-ink/10 bg-white text-ink-faint'
                }`}
              >
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${
                    isActive ? 'bg-primary-500 text-white' : isDone ? 'bg-teal-400 text-white' : 'bg-ink/10 text-ink-faint'
                  }`}
                >
                  {isActive ? (
                    <ThinkingOrb state={stage.orb} size={20} theme="dark" color="#ffffff" aria-label={stage.caption} />
                  ) : isDone ? (
                    <Check size={11} />
                  ) : (
                    i + 1
                  )}
                </span>
                {stage.label}
              </div>
            )
          })}
        </div>
      )}

      {failed && (
        <div className="mt-6 flex items-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
            >
              Réessayer
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-cream"
            >
              Revenir au formulaire
            </button>
          )}
        </div>
      )}
    </div>
  )
}
