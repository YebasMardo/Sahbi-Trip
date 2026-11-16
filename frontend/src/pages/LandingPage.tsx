import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Compass,
  LayoutDashboard,
  Languages,
  Layers,
  ListChecks,
  MapPin,
  Menu,
  Search,
  Sparkles,
  Wallet,
  Wand2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LandingPreview from '../components/LandingPreview'
import Logo from '../components/Logo'
import { destinations } from '../data/destinations'
import { selectAccessToken } from '../features/auth/auth.slice'
import { useAppSelector } from '../store'

const NAV_LINKS = [
  { label: 'Comment ça marche', href: '#comment-ca-marche' },
  { label: 'Pourquoi Sahbi Trip', href: '#pourquoi' },
  { label: 'Destinations', href: '#destinations' },
  { label: 'FAQ', href: '#faq' },
]

const HERO_ROTATE_MS = 7000

const HERO_SLIDES = [
  {
    city: 'Marrakech',
    tagline: 'La ville rouge',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Djemaa_el_Fna.jpg?width=2000',
    alt: 'Place Jemaa el-Fna à Marrakech, au coucher du soleil',
    credit: 'Boris Macek, CC BY-SA 3.0',
    stops: ['Place Jemaa el-Fna', 'Palais de la Bahia', 'Mosquée Koutoubia'],
  },
  {
    city: 'Casablanca',
    tagline: 'La métropole atlantique',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sunrise_in_Casablanca_with_Hassan_II_Mosque.jpg?width=2000',
    alt: 'Lever de soleil sur la mosquée Hassan II à Casablanca',
    credit: 'SpreeTom, CC BY-SA 4.0',
    stops: ['Mosquée Hassan II', "Corniche d'Aïn Diab"],
  },
  {
    city: 'Rabat',
    tagline: 'La capitale royale',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kasbah_Oudayas_exterior.jpg?width=2000',
    alt: 'Kasbah des Oudayas à Rabat',
    credit: 'Davide Cesare Veniani, CC BY-SA 3.0',
    stops: ['Kasbah des Oudayas', 'Mausolée Mohammed V', 'Chellah'],
  },
]

const PROBLEMS = [
  {
    icon: MapPin,
    title: 'Trop de villes, pas assez de temps',
    body: "Marrakech, Casablanca, Rabat... difficile de savoir combien de jours donner à chacune sans se presser ni rien manquer.",
  },
  {
    icon: Search,
    title: 'Des recommandations trop génériques',
    body: 'Les guides listent souvent les mêmes lieux pour tout le monde, sans tenir compte de votre budget ou de vos envies.',
  },
  {
    icon: Wallet,
    title: 'Un budget difficile à estimer',
    body: "Entre activités, repas et transport, on découvre souvent le vrai coût du voyage une fois sur place.",
  },
  {
    icon: Layers,
    title: 'Des heures passées à comparer des onglets',
    body: 'Sites de réservation, forums, blogs de voyage : construire un itinéraire jour par jour à la main prend du temps.',
  },
]

const STEPS = [
  {
    icon: ListChecks,
    title: 'Dites-nous ce que vous voulez',
    body: 'Dates, budget, nombre de voyageurs, envies. En français, en anglais ou en une phrase libre, comme vous voulez.',
  },
  {
    icon: Search,
    title: 'On compare ce qui existe vraiment',
    body: 'On passe en revue les activités et restaurants de notre catalogue Marrakech, Casablanca et Rabat pour ne garder que ce qui correspond à vos critères.',
  },
  {
    icon: Wand2,
    title: 'Votre itinéraire prend forme',
    body: 'Jour par jour, avec horaires, durées et prix réels — jamais inventés.',
  },
  {
    icon: Sparkles,
    title: 'Ajustez en un clic',
    body: '« Remplacer », « ajouter une activité », ou « il me reste 400 MAD » : le voyage se réorganise instantanément.',
  },
]

const FEATURES = [
  {
    icon: MapPin,
    title: 'Un catalogue Morocco-first',
    body: 'Concentré sur Casablanca, Marrakech et Rabat — pas un guide générique passé en revue à la va-vite.',
  },
  {
    icon: BadgeCheck,
    title: 'Des prix que vous pouvez vérifier',
    body: "Chaque activité affiche son prix, sa source et son niveau de confiance. Quand on ne sait pas, on l'écrit : « non renseigné ».",
  },
  {
    icon: Wallet,
    title: 'Un budget calculé, pas deviné',
    body: 'Le total, le reste à dépenser et la répartition par poste sont recalculés automatiquement à chaque changement.',
  },
  {
    icon: Languages,
    title: 'Écrivez comme vous parlez',
    body: 'En français, en anglais ou en une phrase libre — décrivez vos dates, votre budget et vos envies avec vos mots.',
  },
  {
    icon: ListChecks,
    title: 'Un itinéraire jour par jour',
    body: 'Horaires, durées et enchaînements posés à l\'avance, activité par activité — pas une liste en vrac.',
  },
  {
    icon: Compass,
    title: 'Déjà sur place ? On rajuste',
    body: 'Changement de programme, budget qui a bougé : on repart de votre situation actuelle, pas de zéro.',
  },
]

const GALLERY = [
  {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Djemaa_el_Fna.jpg?width=600',
    alt: 'Place Jemaa el-Fna, Marrakech',
    pos: 'top-0 left-[6%] w-36 h-44 -rotate-6',
  },
  {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bahia_Palace_large_court.jpg?width=600',
    alt: 'Palais de la Bahia, Marrakech',
    pos: 'top-[2%] left-[38%] w-32 h-40 rotate-3',
  },
  {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Koutbia.jpg?width=600',
    alt: 'Mosquée Koutoubia, Marrakech',
    pos: 'top-[4%] right-[8%] w-40 h-32 rotate-6',
  },
  {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Boulevard_de_la_Corniche%2C_Dar-el-Beida%2C_Morocco_-_panoramio_(13).jpg?width=600',
    alt: "Corniche d'Aïn Diab, Casablanca",
    pos: 'top-[30%] right-0 w-32 h-40 -rotate-4',
  },
  {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kasbah_Oudayas_exterior.jpg?width=600',
    alt: 'Kasbah des Oudayas, Rabat',
    pos: 'top-[46%] left-[2%] w-36 h-44 rotate-5',
  },
  {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Morocco_-_Mausoleum_of_Mohammed_V.jpg?width=600',
    alt: 'Mausolée Mohammed V, Rabat',
    pos: 'bottom-0 left-[30%] w-44 h-48 -rotate-3',
  },
  {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Roman_Ruins_Zawiya_Chellah_Rabat_Nov25_A7CR_08989.jpg?width=600',
    alt: 'Chellah, Rabat',
    pos: 'bottom-[6%] right-[16%] w-36 h-44 rotate-4',
  },
]

const FAQS = [
  {
    q: 'Comment fonctionne la personnalisation ?',
    a: "Vous répondez à quelques questions — destinations, dates, budget, envies — ou vous décrivez votre voyage en une phrase libre. L'itinéraire est ensuite construit à partir des activités et restaurants qui correspondent le mieux à vos critères.",
  },
  {
    q: 'Puis-je choisir mes propres destinations ?',
    a: "Oui, parmi les villes couvertes par notre catalogue aujourd'hui : Marrakech, Casablanca et Rabat. D'autres villes s'ajouteront au fur et à mesure.",
  },
  {
    q: "Puis-je adapter l'itinéraire proposé ?",
    a: 'Oui. Depuis le dashboard, vous pouvez remplacer une activité, en ajouter une autre, ou indiquer un budget restant pour que le voyage se réajuste.',
  },
  {
    q: 'Est-ce que Sahbi Trip est gratuit ?',
    a: "Oui : à ce stade, c'est un prototype gratuit à essayer, sans système de paiement.",
  },
  {
    q: 'Dois-je créer un compte ?',
    a: "Non — vous pouvez explorer le générateur et un exemple de dashboard sans créer de compte pour le moment.",
  },
]

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCity, setActiveCity] = useState(0)
  const isAuthenticated = Boolean(useAppSelector(selectAccessToken))

  // Re-armed whenever the city changes, so a manual pick restarts the 7s window.
  useEffect(() => {
    const id = window.setTimeout(() => setActiveCity((c) => (c + 1) % HERO_SLIDES.length), HERO_ROTATE_MS)
    return () => window.clearTimeout(id)
  }, [activeCity])

  return (
    <div className="bg-cream-50">
      {/* ================= HERO ================= */}
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink text-white">
        {/* City backdrops — crossfade, slow push-in on the active one */}
        {HERO_SLIDES.map((s, i) => (
          <img
            key={s.city}
            src={s.url}
            alt={i === activeCity ? s.alt : ''}
            aria-hidden={i !== activeCity}
            loading="eager"
            decoding="async"
            className={`hero-slide absolute inset-0 -z-30 size-full object-cover ${i === activeCity ? 'is-active' : ''}`}
          />
        ))}
        <div className="absolute inset-0 -z-20 bg-gradient-to-r from-ink/85 via-ink/45 to-ink/10" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-t from-ink via-transparent to-ink/60" />
        <div className="hero-zellige absolute inset-y-0 right-0 -z-10 hidden w-1/2 lg:block" aria-hidden="true" />

        {/* Nav */}
        <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6 lg:px-10">
          <Link to="/">
            <Logo dark />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-medium text-white/80 transition-colors hover:text-white">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-5 lg:flex">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-card transition-colors hover:bg-cream"
              >
                <LayoutDashboard size={15} /> Tableau de bord
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-white/80 transition-colors hover:text-white">
                  Se connecter
                </Link>
                <Link
                  to="/signup"
                  className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-card transition-colors hover:bg-cream"
                >
                  Créer un compte
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          {menuOpen && (
            <div className="absolute inset-x-5 top-[72px] z-30 rounded-2xl bg-ink/95 p-5 shadow-card-lg backdrop-blur-md sm:inset-x-8 lg:hidden">
              <nav className="flex flex-col gap-4">
                {NAV_LINKS.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    className="text-sm font-medium text-white/85"
                    onClick={() => setMenuOpen(false)}
                  >
                    {l.label}
                  </a>
                ))}
                {isAuthenticated ? (
                  <Link
                    to="/dashboard"
                    className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-ink"
                    onClick={() => setMenuOpen(false)}
                  >
                    <LayoutDashboard size={15} /> Tableau de bord
                  </Link>
                ) : (
                  <div className="mt-1 flex flex-col gap-2.5">
                    <Link
                      to="/login"
                      className="rounded-full border border-white/20 px-4 py-2.5 text-center text-sm font-semibold text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      Se connecter
                    </Link>
                    <Link
                      to="/signup"
                      className="rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-ink"
                      onClick={() => setMenuOpen(false)}
                    >
                      Créer un compte
                    </Link>
                  </div>
                )}
              </nav>
            </div>
          )}
        </header>

        {/* Headline + preview */}
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-10 pt-6 sm:px-8 lg:px-10">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div>
              <h1
                className="hero-rise font-display text-[2.7rem] font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4.5rem]"
                style={{ animationDelay: '60ms' }}
              >
                Planifiez votre voyage au Maroc,{' '}
                <span className="bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">
                  sans le stress.
                </span>
              </h1>
              <p
                className="hero-rise mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg"
                style={{ animationDelay: '120ms' }}
              >
                Dites-nous vos dates, votre budget et vos envies. On construit un itinéraire jour par jour à partir
                d'un catalogue sourcé de {destinations.map((d) => d.city).join(', ')}.
              </p>
              <div
                className="hero-rise mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
                style={{ animationDelay: '180ms' }}
              >
                <Link
                  to="/dashboard/trips/new"
                  className="hero-press flex items-center justify-center gap-2 rounded-full bg-primary-500 px-7 py-4 text-sm font-semibold text-white shadow-card-lg transition-colors hover:bg-primary-600"
                >
                  Planifier mon voyage <ArrowRight size={16} />
                </Link>
                <a
                  href="#apercu"
                  className="hero-press flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 px-7 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                >
                  Voir un exemple de voyage
                </a>
              </div>
              <p
                className="hero-rise mt-6 inline-flex items-center gap-2 text-xs font-medium text-white/70 sm:text-sm"
                style={{ animationDelay: '240ms' }}
              >
                <BadgeCheck size={16} className="text-primary-300" /> Prix vérifiés et sourcés — jamais inventés
              </p>
            </div>

            {/* Editorial list over the photo: example stops for the selected city */}
            <aside
              className="hero-rise hidden justify-self-end border-l border-white/40 pl-8 lg:block lg:w-[320px]"
              style={{ animationDelay: '300ms', textShadow: '0 1px 14px rgba(0,0,0,0.45)' }}
              aria-label={`Exemples d'étapes à ${HERO_SLIDES[activeCity].city}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">À ne pas manquer</p>
              <div key={HERO_SLIDES[activeCity].city} className="hero-fade">
                <p className="mt-2 font-display text-4xl font-extrabold leading-none text-white">
                  {HERO_SLIDES[activeCity].city}
                </p>
                <ol className="mt-6">
                  {HERO_SLIDES[activeCity].stops.map((stop, i) => (
                    <li key={stop} className="flex items-baseline gap-4 border-t border-white/30 py-3.5">
                      <span className="font-display text-sm font-bold tabular-nums text-primary-300">0{i + 1}</span>
                      <span className="text-base font-medium text-white">{stop}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </div>

        {/* City selector + progress */}
        <div className="relative z-10 border-t border-white/25">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-3 px-5 sm:px-8 lg:px-10">
            {HERO_SLIDES.map((s, i) => {
              const active = i === activeCity
              return (
                <button
                  key={s.city}
                  type="button"
                  onClick={() => setActiveCity(i)}
                  aria-pressed={active}
                  className="group relative py-4 pr-3 text-left sm:py-5"
                >
                  <span
                    className={`block text-[11px] font-bold tabular-nums transition-colors ${active ? 'text-primary-300' : 'text-white/40 group-hover:text-white/70'}`}
                  >
                    0{i + 1}
                  </span>
                  <span
                    className={`mt-0.5 block font-display text-sm font-bold transition-colors sm:text-base ${active ? 'text-white' : 'text-white/60 group-hover:text-white/90'}`}
                  >
                    {s.city}
                  </span>
                  <span className="mt-0.5 hidden text-xs text-white/50 sm:block">{s.tagline}</span>
                  <span className="absolute inset-x-0 top-0 h-[2px] bg-white/10">
                    {active && <span className="hero-progress absolute inset-0 origin-left bg-primary-400" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <span className="absolute bottom-[88px] right-5 z-10 hidden text-[10px] text-white/45 sm:bottom-[104px] sm:right-8 sm:block lg:right-10">
          © {HERO_SLIDES[activeCity].credit}
        </span>
      </section>

      {/* ================= PROBLEM ================= */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary-500">Le vrai problème</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              Organiser un voyage au Maroc prend souvent plus de temps que prévu.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <div key={p.title} className="flex gap-4">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ink/5 text-ink">
                  <p.icon size={16} />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold text-ink">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="comment-ca-marche" className="border-t border-ink/5 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
            <div className="relative h-[340px] overflow-hidden rounded-3xl sm:h-[420px] lg:h-[520px]">
              <img
                src="https://commons.wikimedia.org/wiki/Special:FilePath/Le_jardin_des_majorelle_40.JPG?width=1000"
                alt="Jardin Majorelle, Marrakech"
                className="size-full object-cover"
                loading="lazy"
              />
              <span className="absolute bottom-3 right-3 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
                © Viault, CC BY-SA 3.0
              </span>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary-500">Comment ça marche</span>
              <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
                Du questionnaire à votre itinéraire
              </h2>

              <div className="mt-8 flex flex-col">
                {STEPS.map((step, i) => (
                  <div
                    key={step.title}
                    className={`py-5 ${i === 0 ? 'rounded-2xl bg-cream px-5 -mx-5' : 'border-t border-ink/5'}`}
                  >
                    <h3 className="flex items-center gap-2.5 font-display text-base font-bold text-ink">
                      <step.icon size={17} className="text-primary-500" /> {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SOLUTION / FEATURES ================= */}
      <section id="pourquoi" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Pas un chatbot générique"
            title="Ce qui rend Sahbi Trip différent"
            body="Un planificateur pensé pour le Maroc, transparent sur ses données, avec un vrai fil jour par jour."
          />

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-ink/5 bg-white p-6 shadow-card">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary-500">
                  <f.icon size={18} />
                </span>
                <h3 className="mt-4 font-display text-[15px] font-bold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRODUCT SHOWCASE ================= */}
      <section id="apercu" className="scroll-mt-20 py-4">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <LandingPreview />
        </div>
      </section>

      {/* ================= MOTEUR IA ================= */}
      <section id="moteur-ia" className="py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-ink px-6 py-12 text-white sm:px-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/85">
              <Sparkles size={13} /> Sous le capot
            </span>
            <h2 className="mt-5 max-w-xl font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
              Le voyage est calculé, pas improvisé par un seul prompt.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
              Vos préférences passent par une recherche sur le catalogue sourcé, un tri par pertinence, puis un
              modèle qui organise le résultat en itinéraire. Les totaux et le budget sont recalculés par du code,
              jamais devinés par le modèle.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              {['Recherche', 'Tri par pertinence', 'Génération', 'Itinéraire + budget'].map((step, i, arr) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/85">
                    {step}
                  </span>
                  {i < arr.length - 1 && <ArrowRight size={14} className="text-white/30" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= DESTINATIONS / GALLERY ================= */}
      <section id="destinations" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="relative hidden h-[560px] sm:block lg:h-[620px]">
            {GALLERY.map((g) => (
              <img
                key={g.url}
                src={g.url}
                alt={g.alt}
                loading="lazy"
                className={`absolute rounded-2xl object-cover shadow-card-lg ${g.pos}`}
              />
            ))}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary-500">Galerie</span>
              <h2 className="mt-3 max-w-sm font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
                Un pays entier à explorer, une ville à la fois.
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
                Aujourd'hui : {destinations.map((d) => d.city).join(', ')}. Demain, le reste du Maroc — médinas,
                montagnes et côtes comprises.
              </p>
            </div>
          </div>

          <div className="sm:hidden">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary-500">Galerie</span>
              <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-ink">
                Un pays entier à explorer, une ville à la fois.
              </h2>
              <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
                Aujourd'hui : {destinations.map((d) => d.city).join(', ')}. Demain, le reste du Maroc — médinas,
                montagnes et côtes comprises.
              </p>
            </div>
            <div className="scrollbar-none mt-8 flex gap-3 overflow-x-auto pb-2">
              {GALLERY.map((g) => (
                <img
                  key={g.url}
                  src={g.url}
                  alt={g.alt}
                  loading="lazy"
                  className="h-36 w-32 shrink-0 rounded-2xl object-cover shadow-card"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="border-t border-ink/5 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <SectionHeading eyebrow="Avant de vous lancer" title="Questions fréquentes" body="" />

          <div className="mt-10 flex flex-col divide-y divide-ink/5">
            {FAQS.map((item) => (
              <FaqItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA + FOOTER (continuous) ================= */}
      <section className="bg-cream-50 py-20 text-center sm:py-24">
        <div className="mx-auto max-w-2xl px-5 lg:px-8">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary-500">Prochaine étape</span>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
            Prêt à voir votre voyage prendre forme ?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-ink-soft">
            Ouvrez le générateur, répondez à quelques questions, et laissez votre itinéraire Marrakech · Casablanca
            · Rabat se construire jour par jour.
          </p>
          <Link
            to="/dashboard/trips/new"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-500 px-7 py-3.5 text-sm font-semibold text-white shadow-card-lg transition-colors hover:bg-primary-600"
          >
            Planifier mon voyage <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <div className="relative h-[280px] overflow-hidden sm:h-[360px] lg:h-[420px]">
        <img
          src="https://commons.wikimedia.org/wiki/Special:FilePath/Kasbah_Oudayas_exterior.jpg?width=1600"
          alt="Kasbah des Oudayas, Rabat"
          className="size-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/50 to-ink" />
      </div>

      <footer className="bg-ink pb-8 pt-14 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.3fr_1fr_1fr]">
            <div>
              <Logo dark />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
                Sahbi Trip transforme vos préférences, votre budget et votre durée en un itinéraire personnalisé
                — jour par jour, avec des prix sourcés.
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Liens</p>
              <nav className="mt-4 flex flex-col gap-2.5">
                {NAV_LINKS.map((l) => (
                  <a key={l.label} href={l.href} className="text-sm text-white/70 transition-colors hover:text-white">
                    {l.label}
                  </a>
                ))}
                <Link to="/dashboard/trips/new" className="text-sm text-white/70 transition-colors hover:text-white">
                  Planifier mon voyage
                </Link>
              </nav>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Couverture actuelle</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {destinations.map((d) => (
                  <li key={d.city} className="text-sm text-white/70">
                    {d.city}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Sahbi Trip</p>
            <p>AI Travel OS for Morocco</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary-500">{eyebrow}</span>
      <h2 className="mt-3 font-display text-3xl font-extrabold text-ink sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 text-base text-ink-soft">{body}</p>}
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <span className="font-display text-[15px] font-bold text-ink">{question}</span>
        <ChevronDown size={17} className={`shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="mt-2.5 pr-8 text-sm leading-relaxed text-ink-soft">{answer}</p>}
    </div>
  )
}

