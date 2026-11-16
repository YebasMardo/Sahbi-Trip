import {
  Bell,
  Compass,
  LayoutDashboard,
  Loader2,
  LogOut,
  Luggage,
  Map,
  Plane,
  Plus,
  User,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import FloatingChatWidget from '../components/chat/FloatingChatWidget'
import Logo from '../components/Logo'
import { useLogoutMutation } from '../features/auth/auth.apiSlice'
import { logout as logoutAction, selectAuthUser, selectRefreshToken } from '../features/auth/auth.slice'
import { useAppDispatch, useAppSelector } from '../store'

const NAV_ITEMS = [
  { label: 'Tableau de bord', to: '/dashboard', icon: LayoutDashboard, match: (p: string) => p === '/dashboard' },
  {
    label: 'Mes voyages',
    to: '/dashboard/trips',
    icon: Luggage,
    match: (p: string) => p.startsWith('/dashboard/trips'),
  },
  { label: 'Carte', to: '/dashboard', icon: Map, match: () => false },
  { label: 'Découvrir', to: '/dashboard', icon: Compass, match: () => false },
  { label: 'Profil', to: '/dashboard', icon: User, match: () => false },
]

function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-ink/5 bg-white px-4 py-6 lg:flex">
      <div>
        <Link to="/" className="mb-6 flex items-center px-2">
          <Logo />
        </Link>

        <Link
          to="/dashboard/trips/new"
          className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-3 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600"
        >
          <Plus size={16} /> Nouveau voyage
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname)
            const Icon = item.icon
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`group flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-primary-500 bg-primary-50 text-primary-600'
                    : 'border-transparent text-ink-soft hover:bg-cream hover:text-ink'
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={2}
                  className={active ? 'text-primary-500' : 'text-ink-faint group-hover:text-ink-soft'}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#3a2a22] via-[#5a3624] to-primary-500 px-4 py-5 text-white">
        <MountainGlyph className="pointer-events-none absolute inset-x-0 bottom-0 text-white/10" />
        <p className="relative font-display text-[15px] font-semibold leading-snug">Le Maroc vous attend</p>
        <p className="relative mt-1 text-xs leading-relaxed text-white/70">
          Des expériences uniques, créées par l'IA.
        </p>
        <div className="relative mt-4 flex items-center gap-1.5 text-xs font-medium text-white/80">
          <Plane size={13} /> Sahbi Trip
        </div>
      </div>
    </aside>
  )
}

function MountainGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 80" className={className} fill="currentColor" aria-hidden>
      <path d="M0 80 L35 30 L55 55 L85 15 L120 60 L145 35 L200 80 Z" />
    </svg>
  )
}

/** "Yasmine El Amrani" → "YE". Falls back to the email's first letter. */
function initialsFor(fullname: string | undefined, email: string | undefined): string {
  const parts = (fullname ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (email ?? '?').slice(0, 1).toUpperCase()
}

function firstNameOf(fullname: string | undefined, email: string | undefined): string {
  const first = (fullname ?? '').trim().split(/\s+/)[0]
  return first || (email ?? '').split('@')[0] || 'Voyageur'
}

function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  const user = useAppSelector(selectAuthUser)
  const refreshToken = useAppSelector(selectRefreshToken)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    // Revoke the refresh token server-side when we still have it; the local
    // session is cleared either way so a failed revoke never traps the user
    // in a logged-in shell.
    if (refreshToken) {
      try {
        await logout(refreshToken).unwrap()
      } catch {
        dispatch(logoutAction())
      }
    } else {
      dispatch(logoutAction())
    }
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex items-center justify-between px-6 py-6 lg:px-10">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="grid size-10 place-items-center rounded-full bg-white text-ink-soft shadow-card transition-colors hover:text-primary-500"
        >
          <Bell size={18} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-full bg-white py-1 pl-1 pr-3 shadow-card"
          >
            <span className="grid size-8 place-items-center rounded-full bg-primary-100 font-display text-xs font-bold text-primary-600">
              {initialsFor(user?.fullname, user?.email)}
            </span>
            <span className="text-sm font-medium text-ink">{firstNameOf(user?.fullname, user?.email)}</span>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl bg-white py-1.5 shadow-card-lg ring-1 ring-ink/5">
                <div className="px-3.5 py-2">
                  <p className="truncate text-sm font-semibold text-ink">{user?.fullname ?? '—'}</p>
                  <p className="truncate text-xs text-ink-faint">{user?.email ?? ''}</p>
                </div>
                <div className="my-1 border-t border-ink/5" />
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-rose-500 hover:bg-rose-50 disabled:opacity-60"
                >
                  {isLoggingOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                  Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default function DashboardLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <div className="h-screen flex-1 overflow-y-auto">
        <Topbar title={title} subtitle={subtitle} />
        <main className="px-4 pb-12 lg:px-10">{children}</main>
      </div>
      <FloatingChatWidget />
    </div>
  )
}
