import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../Logo'

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-10">
      <Link to="/" className="mb-8">
        <Logo />
      </Link>

      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-card-lg sm:p-8">
        <h1 className="font-display text-xl font-extrabold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}

        <div className="mt-6">{children}</div>
      </div>

      {footer && <div className="mt-6 text-sm text-ink-soft">{footer}</div>}
    </div>
  )
}
