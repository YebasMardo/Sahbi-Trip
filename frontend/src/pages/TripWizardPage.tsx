import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Sparkles, Type, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { errorMessage } from '../components/QueryState'
import ChipSelect from '../components/wizard/ChipSelect'
import GeneratingScreen, { type GenerationPhase } from '../components/wizard/GeneratingScreen'
import RadioCard from '../components/wizard/RadioCard'
import Stepper from '../components/wizard/Stepper'
import WizardProgress from '../components/wizard/WizardProgress'
import {
  useCreateTripMutation,
  useExtractProfileMutation,
  useGenerateTripMutation,
} from '../features/trips/trips.apiSlice'
import {
  AVAILABLE_CITIES,
  COMFORT_LEVELS,
  DIETARY_OPTIONS,
  INTERCITY_TRANSPORT_MODES,
  INTEREST_OPTIONS,
  PACE_OPTIONS,
  TRANSPORT_MODES,
  TRAVELER_TYPES,
  applyProfile,
  cityDaysValid,
  defaultTripTitle,
  defaultWizardState,
  distributeDays,
  interestLabel,
  toCreateTripPayload,
  type CityName,
  type WizardFormState,
} from '../features/trips/wizard'

const STEP_LABELS = ['Destination', 'Voyageurs', 'Budget', 'Envies', 'Récapitulatif']

const FREE_TEXT_EXAMPLE =
  'Ex : « Je suis à Marrakech maintenant. J\'ai 1 500 DH pour 2 jours. Nous sommes 2 personnes. J\'aime la nourriture et la culture mais je ne veux pas faire des activités trop touristiques. »'

export default function TripWizardPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<WizardFormState>(defaultWizardState())
  const [step, setStep] = useState(0)

  const [createTrip] = useCreateTripMutation()
  const [generateTrip] = useGenerateTripMutation()
  const [extractProfile, { isLoading: isExtracting }] = useExtractProfileMutation()

  const [phase, setPhase] = useState<GenerationPhase | null>(null)
  const [failure, setFailure] = useState<string | undefined>()
  const [extractError, setExtractError] = useState<string | undefined>()
  /**
   * The draft created by an attempt whose generation then failed, so a retry
   * reuses it instead of creating another. Cleared on cancel: once the
   * traveler is back in the form they may change the answers, and this draft
   * was saved with the old ones.
   */
  const createdTripId = useRef<string | null>(null)

  function update<K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleCity(city: CityName) {
    setForm((f) => {
      const cities = f.cities.includes(city) ? f.cities.filter((c) => c !== city) : [...f.cities, city]
      return { ...f, cities, cityDays: cities.length > 1 ? distributeDays(cities, f.durationDays) : {} }
    })
  }

  /** Duration lives in step 0, ahead of the per-city allocator in the recap — resetting it there is safe. */
  function setDuration(durationDays: number) {
    setForm((f) => ({
      ...f,
      durationDays,
      cityDays: f.cities.length > 1 ? distributeDays(f.cities, durationDays) : f.cityDays,
    }))
  }

  function setCityDays(city: string, days: number) {
    setForm((f) => ({ ...f, cityDays: { ...f.cityDays, [city]: days } }))
  }

  function toggleInterest(interest: string) {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(interest)
        ? f.interests.filter((i) => i !== interest)
        : [...f.interests, interest],
    }))
  }

  /**
   * Free-text entry point (guide §3.2): the LLM turns the sentence into a
   * structured profile, which pre-fills the form. The traveler still reviews
   * the recap before anything is created — the extraction is a shortcut, not a
   * bypass.
   */
  async function handleFreeTextContinue() {
    setExtractError(undefined)
    try {
      const result = await extractProfile(form.freeText).unwrap()
      setForm((f) => applyProfile(f, result.data))
      setStep(STEP_LABELS.length - 1)
    } catch (e) {
      setExtractError(errorMessage(e) ?? "L'IA n'a pas pu lire cette description.")
    }
  }

  /** Create the trip, then run the AI pipeline on it, then open the proposal. */
  async function handleGenerate() {
    setFailure(undefined)
    setPhase('creating')
    // Reuse the trip a previous attempt already created. Generation is the
    // step that fails (a provider rate limit is the common case) and `onRetry`
    // re-enters here, so creating unconditionally would leave the traveler
    // with one extra draft trip per retry.
    let tripId: string
    if (createdTripId.current) {
      tripId = createdTripId.current
    } else {
      try {
        const created = await createTrip(toCreateTripPayload(form)).unwrap()
        tripId = created.data.id
        createdTripId.current = tripId
      } catch (e) {
        setFailure(errorMessage(e) ?? "La création du voyage a échoué.")
        setPhase('error')
        return
      }
    }

    setPhase('generating')
    try {
      await generateTrip(tripId).unwrap()
      navigate(`/dashboard/trips/${tripId}`)
    } catch (e) {
      // The trip exists even though generation failed — send the traveler to it
      // so the work is not lost and they can retry from the overview.
      setFailure(
        `${errorMessage(e) ?? "La génération a échoué."} Votre voyage a été enregistré comme brouillon.`,
      )
      setPhase('error')
    }
  }

  if (phase) {
    return (
      <GeneratingScreen
        phase={phase}
        error={failure}
        onRetry={() => void handleGenerate()}
        onCancel={() => {
          setPhase(null)
          setFailure(undefined)
          createdTripId.current = null
        }}
      />
    )
  }

  const canGoNext =
    step !== 0 ||
    form.mode === 'freeText' ||
    (form.cities.length > 0 && form.startDate.length > 0 && form.durationDays > 0)

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-5 py-5 lg:px-10">
        <Logo />
        <Link
          to="/dashboard/trips"
          aria-label="Fermer"
          className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-white hover:text-ink"
        >
          <X size={18} />
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-20 lg:px-8">
        <div className="mb-8">
          <WizardProgress steps={STEP_LABELS} current={step} />
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-card-lg sm:p-8">
          {step === 0 && (
            <StepDestination
              form={form}
              update={update}
              toggleCity={toggleCity}
              setDuration={setDuration}
              onFreeTextContinue={() => void handleFreeTextContinue()}
              isExtracting={isExtracting}
              extractError={extractError}
            />
          )}
          {step === 1 && <StepTravelers form={form} update={update} />}
          {step === 2 && <StepBudget form={form} update={update} />}
          {step === 3 && <StepInterests form={form} update={update} toggleInterest={toggleInterest} />}
          {step === 4 && <StepRecap form={form} update={update} setCityDays={setCityDays} />}
        </div>

        {(step !== 0 || form.mode === 'guided') && (
          <div className="mt-6 flex items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-cream"
              >
                <ArrowLeft size={15} /> Précédent
              </button>
            ) : (
              <span />
            )}

            {step < STEP_LABELS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canGoNext}
                className="flex items-center gap-1.5 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600 disabled:opacity-40"
              >
                Suivant <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={form.cities.length === 0 || !cityDaysValid(form)}
                className="flex items-center gap-2 rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white shadow-card-lg transition-colors hover:bg-primary-600 disabled:opacity-40"
              >
                <Sparkles size={15} /> Générer mon voyage
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------
// Steps
// ---------------------------------------------------------------

function StepDestination({
  form,
  update,
  toggleCity,
  setDuration,
  onFreeTextContinue,
  isExtracting,
  extractError,
}: {
  form: WizardFormState
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void
  toggleCity: (city: CityName) => void
  setDuration: (durationDays: number) => void
  onFreeTextContinue: () => void
  isExtracting: boolean
  extractError?: string
}) {
  return (
    <div>
      <div className="mb-6 flex gap-2 rounded-full bg-cream p-1">
        <button
          type="button"
          onClick={() => update('mode', 'guided')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors ${
            form.mode === 'guided' ? 'bg-white text-ink shadow-card' : 'text-ink-soft'
          }`}
        >
          <MapPin size={14} /> Formulaire guidé
        </button>
        <button
          type="button"
          onClick={() => update('mode', 'freeText')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors ${
            form.mode === 'freeText' ? 'bg-white text-ink shadow-card' : 'text-ink-soft'
          }`}
        >
          <Type size={14} /> Texte libre
        </button>
      </div>

      {form.mode === 'freeText' ? (
        <div>
          <h2 className="font-display text-xl font-extrabold text-ink">Décrivez votre voyage</h2>
          <p className="mt-1 text-sm text-ink-soft">
            En français, en anglais ou en darija — l'IA extrait vos dates, votre budget et vos envies.
          </p>
          <textarea
            value={form.freeText}
            onChange={(e) => update('freeText', e.target.value)}
            rows={5}
            placeholder={FREE_TEXT_EXAMPLE}
            className="mt-4 w-full rounded-2xl border border-ink/10 bg-cream-50 p-4 text-sm text-ink placeholder:text-ink-faint/70 focus:border-primary-400 focus:outline-none"
          />
          {extractError && (
            <p className="mt-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-600">{extractError}</p>
          )}
          <button
            type="button"
            onClick={onFreeTextContinue}
            disabled={form.freeText.trim().length < 10 || isExtracting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600 disabled:opacity-40"
          >
            {isExtracting ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Analyse par l'IA…
              </>
            ) : (
              <>
                Continuer avec ce texte <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      ) : (
        <div>
          <h2 className="font-display text-xl font-extrabold text-ink">Où voulez-vous aller ?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Sélectionnez une ou plusieurs villes couvertes par notre catalogue.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {AVAILABLE_CITIES.map((city) => (
              <ChipSelect
                key={city}
                label={city}
                selected={form.cities.includes(city)}
                onToggle={() => toggleCity(city)}
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">Date de départ</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-primary-400 focus:outline-none"
              />
            </label>
            <div>
              <span className="text-xs font-semibold text-ink-soft">Durée</span>
              <div className="mt-1.5">
                <Stepper value={form.durationDays} onChange={setDuration} min={1} max={10} suffix="jours" />
              </div>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-center justify-between rounded-2xl bg-cream px-4 py-3">
            <span className="text-sm font-medium text-ink">Je suis déjà au Maroc</span>
            <input
              type="checkbox"
              checked={form.alreadyInMorocco}
              onChange={(e) => update('alreadyInMorocco', e.target.checked)}
              className="size-4 accent-primary-500"
            />
          </label>
          {form.alreadyInMorocco && (
            <label className="mt-3 block">
              <span className="text-xs font-semibold text-ink-soft">Ville actuelle</span>
              <input
                type="text"
                value={form.currentCity}
                onChange={(e) => update('currentCity', e.target.value)}
                placeholder="Ex : Marrakech"
                className="mt-1.5 w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-primary-400 focus:outline-none"
              />
            </label>
          )}
        </div>
      )}
    </div>
  )
}

function StepTravelers({
  form,
  update,
}: {
  form: WizardFormState
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void
}) {
  return (
    <div>
      <h2 className="font-display text-xl font-extrabold text-ink">Qui voyage ?</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Le nombre de voyageurs influence le budget et les activités proposées.
      </p>

      <div className="mt-6">
        <span className="text-xs font-semibold text-ink-soft">Nombre de voyageurs</span>
        <div className="mt-2">
          <Stepper value={form.travelers} onChange={(v) => update('travelers', v)} min={1} max={8} />
        </div>
      </div>

      <div className="mt-6">
        <span className="text-xs font-semibold text-ink-soft">Type de voyage</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRAVELER_TYPES.map((t) => (
            <RadioCard
              key={t.value}
              label={t.label}
              selected={form.travelerType === t.value}
              onSelect={() => update('travelerType', t.value)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StepBudget({
  form,
  update,
}: {
  form: WizardFormState
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void
}) {
  return (
    <div>
      <h2 className="font-display text-xl font-extrabold text-ink">Quel est votre budget ?</h2>
      <p className="mt-1 text-sm text-ink-soft">Budget total pour l'ensemble du groupe, en MAD.</p>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold text-ink-soft">Budget total</span>
          <span className="font-display text-lg font-extrabold text-ink">
            {form.budgetTotal.toLocaleString('fr-FR')} MAD
          </span>
        </div>
        <input
          type="range"
          min={500}
          max={20000}
          step={100}
          value={form.budgetTotal}
          onChange={(e) => update('budgetTotal', Number(e.target.value))}
          className="mt-3 w-full accent-primary-500"
        />
      </div>

      <label className="mt-6 flex cursor-pointer items-center justify-between rounded-2xl bg-cream px-4 py-3">
        <span className="text-sm font-medium text-ink">Je ne sais pas encore pour le logement</span>
        <input
          type="checkbox"
          checked={form.budgetLodging === null}
          onChange={(e) => update('budgetLodging', e.target.checked ? null : 1000)}
          className="size-4 accent-primary-500"
        />
      </label>

      {form.budgetLodging !== null && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-ink-soft">Budget logement (optionnel)</span>
            <span className="font-display text-sm font-bold text-ink">
              {form.budgetLodging.toLocaleString('fr-FR')} MAD
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={8000}
            step={100}
            value={form.budgetLodging}
            onChange={(e) => update('budgetLodging', Number(e.target.value))}
            className="mt-3 w-full accent-primary-500"
          />
        </div>
      )}

      <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl bg-cream px-4 py-3">
        <span className="text-sm font-medium text-ink">Je veux plafonner le budget activités</span>
        <input
          type="checkbox"
          checked={form.budgetActivities !== null}
          onChange={(e) => update('budgetActivities', e.target.checked ? 1000 : null)}
          className="size-4 accent-primary-500"
        />
      </label>

      {form.budgetActivities !== null && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-ink-soft">Budget activités (optionnel)</span>
            <span className="font-display text-sm font-bold text-ink">
              {form.budgetActivities.toLocaleString('fr-FR')} MAD
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={6000}
            step={100}
            value={form.budgetActivities}
            onChange={(e) => update('budgetActivities', Number(e.target.value))}
            className="mt-3 w-full accent-primary-500"
          />
          <p className="mt-1.5 text-[11px] text-ink-faint">
            L'IA essaiera de rester sous ce plafond pour les activités, en plus du budget total.
          </p>
        </div>
      )}
    </div>
  )
}

function StepInterests({
  form,
  update,
  toggleInterest,
}: {
  form: WizardFormState
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void
  toggleInterest: (interest: string) => void
}) {
  return (
    <div>
      <h2 className="font-display text-xl font-extrabold text-ink">Vos envies et votre style</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Sélectionnez ce qui vous fait vibrer — l'IA priorisera ces catégories.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map((interest) => (
          <ChipSelect
            key={interest.value}
            label={interest.label}
            selected={form.interests.includes(interest.value)}
            onToggle={() => toggleInterest(interest.value)}
          />
        ))}
      </div>

      <div className="mt-6">
        <span className="text-xs font-semibold text-ink-soft">Niveau de confort</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMFORT_LEVELS.map((c) => (
            <RadioCard
              key={c.value}
              label={c.label}
              selected={form.comfort === c.value}
              onSelect={() => update('comfort', c.value)}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <span className="text-xs font-semibold text-ink-soft">Transport privilégié</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRANSPORT_MODES.map((t) => (
            <RadioCard
              key={t.value}
              label={t.label}
              selected={form.transport === t.value}
              onSelect={() => update('transport', t.value)}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <span className="text-xs font-semibold text-ink-soft">Rythme du voyage</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {PACE_OPTIONS.map((p) => (
            <RadioCard
              key={p.value}
              label={`${p.label} · ${p.hint}`}
              selected={form.pace === p.value}
              onSelect={() => update('pace', p.value)}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <span className="text-xs font-semibold text-ink-soft">Restrictions alimentaires (optionnel)</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((d) => (
            <ChipSelect
              key={d.value}
              label={d.label}
              selected={form.dietary.includes(d.value)}
              onToggle={() =>
                update(
                  'dietary',
                  form.dietary.includes(d.value)
                    ? form.dietary.filter((v) => v !== d.value)
                    : [...form.dietary, d.value],
                )
              }
            />
          ))}
        </div>
      </div>

      <label className="mt-6 flex cursor-pointer items-center justify-between rounded-2xl bg-cream px-4 py-3">
        <span className="text-sm font-medium text-ink">Éviter les activités trop touristiques</span>
        <input
          type="checkbox"
          checked={form.avoidTouristy}
          onChange={(e) => update('avoidTouristy', e.target.checked)}
          className="size-4 accent-primary-500"
        />
      </label>

      <label className="mt-6 block">
        <span className="text-xs font-semibold text-ink-soft">
          Précisions pour l'IA (allergies, mobilité réduite, occasion spéciale…)
        </span>
        <textarea
          value={form.travelNotes}
          onChange={(e) => update('travelNotes', e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ex : « On voyage avec un bébé de 8 mois » ou « anniversaire de mariage, on cherche des lieux romantiques »."
          className="mt-1.5 w-full rounded-2xl border border-ink/10 bg-cream-50 p-3.5 text-sm text-ink placeholder:text-ink-faint/70 focus:border-primary-400 focus:outline-none"
        />
      </label>
    </div>
  )
}

function StepRecap({
  form,
  update,
  setCityDays,
}: {
  form: WizardFormState
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void
  setCityDays: (city: string, days: number) => void
}) {
  const rows: Array<[string, string]> = [
    ['Destinations', form.cities.length > 0 ? form.cities.join(' · ') : 'Non précisé'],
    [
      'Départ',
      form.startDate
        ? new Date(form.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—',
    ],
    ['Durée', `${form.durationDays} jour${form.durationDays > 1 ? 's' : ''}`],
    ['Voyageurs', `${form.travelers} · ${TRAVELER_TYPES.find((t) => t.value === form.travelerType)?.label}`],
    ['Budget total', `${form.budgetTotal.toLocaleString('fr-FR')} MAD`],
    [
      "Centres d'intérêt",
      form.interests.length > 0 ? form.interests.map(interestLabel).join(', ') : 'Non précisé',
    ],
    ['Confort', COMFORT_LEVELS.find((c) => c.value === form.comfort)?.label ?? '—'],
    ['Transport local', TRANSPORT_MODES.find((t) => t.value === form.transport)?.label ?? '—'],
    ['Rythme', PACE_OPTIONS.find((p) => p.value === form.pace)?.label ?? '—'],
    ...(form.cities.length > 1
      ? ([
          [
            'Transport entre les villes',
            INTERCITY_TRANSPORT_MODES.find((t) => t.value === form.intercityTransport)?.label ?? '—',
          ],
        ] as Array<[string, string]>)
      : []),
    ...(form.budgetActivities !== null
      ? ([['Budget activités', `${form.budgetActivities.toLocaleString('fr-FR')} MAD`]] as Array<[string, string]>)
      : []),
    ...(form.dietary.length > 0
      ? ([
          [
            'Restrictions alimentaires',
            form.dietary.map((d) => DIETARY_OPTIONS.find((o) => o.value === d)?.label ?? d).join(', '),
          ],
        ] as Array<[string, string]>)
      : []),
  ]

  return (
    <div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
        <Sparkles size={12} /> Prêt à générer
      </span>
      <h2 className="mt-3 font-display text-xl font-extrabold text-ink">Récapitulatif</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Vérifiez vos critères. L'IA recherchera, comparera et construira un itinéraire jour par jour à partir du
        catalogue sourcé.
      </p>

      <label className="mt-5 block">
        <span className="text-xs font-semibold text-ink-soft">Nom du voyage</span>
        <input
          type="text"
          value={form.customTitle}
          onChange={(e) => update('customTitle', e.target.value)}
          placeholder={defaultTripTitle(form)}
          className="mt-1.5 w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint/70 focus:border-primary-400 focus:outline-none"
        />
      </label>

      {form.mode === 'freeText' && form.freeText && (
        <div className="mt-5 rounded-2xl bg-violet-50 p-4">
          <p className="text-xs font-semibold text-violet-500">Votre demande, telle que lue par l'IA</p>
          <p className="mt-1 text-sm italic text-ink-soft">« {form.freeText} »</p>
        </div>
      )}

      {form.cities.length > 1 && (
        <div className="mt-5 rounded-2xl bg-cream p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold text-ink-soft">Jours par ville</span>
            <CityDaysTotal form={form} />
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {form.cities.map((city) => (
              <div key={city} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5">
                <span className="text-sm font-medium text-ink">{city}</span>
                <Stepper
                  value={cityDaysDisplay(form)[city]}
                  onChange={(v) => setCityDays(city, v)}
                  min={1}
                  max={form.durationDays}
                  suffix="jours"
                />
              </div>
            ))}
          </div>
          {!cityDaysValid(form) && (
            <p className="mt-2 text-[11px] font-medium text-amber-600">
              Le total doit être égal à la durée du voyage ({form.durationDays} jour
              {form.durationDays > 1 ? 's' : ''}).
            </p>
          )}

          <div className="mt-4 border-t border-ink/10 pt-4">
            <span className="text-xs font-semibold text-ink-soft">Transport entre les villes</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {INTERCITY_TRANSPORT_MODES.map((t) => (
                <RadioCard
                  key={t.value}
                  label={`${t.label} · ${t.hint}`}
                  selected={form.intercityTransport === t.value}
                  onSelect={() => update('intercityTransport', t.value)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <dl className="mt-5 divide-y divide-ink/5 rounded-2xl bg-cream">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="text-right font-medium text-ink">{value}</dd>
          </div>
        ))}
        {form.avoidTouristy && (
          <div className="flex items-center gap-1.5 px-4 py-3 text-xs text-ink-faint">
            <Check size={13} className="text-teal-500" /> Éviter les activités trop touristiques
          </div>
        )}
        {form.alreadyInMorocco && (
          <div className="flex items-center gap-1.5 px-4 py-3 text-xs text-ink-faint">
            <Check size={13} className="text-teal-500" /> Déjà au Maroc
            {form.currentCity ? ` — ${form.currentCity}` : ''}
          </div>
        )}
      </dl>

      {form.travelNotes.trim() && (
        <div className="mt-5 rounded-2xl bg-cream p-4">
          <p className="text-xs font-semibold text-ink-soft">Précisions pour l'IA</p>
          <p className="mt-1 text-sm italic text-ink-soft">« {form.travelNotes.trim()} »</p>
        </div>
      )}
    </div>
  )
}

/** The traveler's own edits, falling back to an even split for any city not yet touched. */
function cityDaysDisplay(form: WizardFormState): Record<string, number> {
  const fallback = distributeDays(form.cities, form.durationDays)
  const merged: Record<string, number> = {}
  for (const city of form.cities) merged[city] = form.cityDays[city] ?? fallback[city]
  return merged
}

function CityDaysTotal({ form }: { form: WizardFormState }) {
  const days = cityDaysDisplay(form)
  const total = form.cities.reduce((s, c) => s + (days[c] ?? 0), 0)
  const ok = total === form.durationDays
  return (
    <span className={`text-xs font-semibold ${ok ? 'text-teal-500' : 'text-amber-600'}`}>
      {total} / {form.durationDays} jours
    </span>
  )
}
