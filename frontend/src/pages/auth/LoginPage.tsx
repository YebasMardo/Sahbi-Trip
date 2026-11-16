import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import FormField from '../../components/auth/FormField'
import { applyServerErrors } from '../../features/auth/applyServerErrors'
import { useLoginMutation } from '../../features/auth/auth.apiSlice'
import { loginSchema, type LoginFormValues } from '../../features/auth/validation'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Where ProtectedRoute sent them from, e.g. /dashboard/trips/new when they
  // clicked "Planifier mon voyage" while logged out — falls back to /dashboard.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard'
  const [login, { isLoading }] = useLoginMutation()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginFormValues) {
    setBanner(null)
    try {
      const result = await login(values).unwrap()
      if (result.data.status === 'OK') {
        navigate(from, { replace: true })
      } else {
        navigate('/verify-email', { state: { from } })
      }
    } catch (error) {
      setBanner(applyServerErrors(error as FetchBaseQueryError | SerializedError, setError))
    }
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Accédez à vos voyages."
      footer={
        <span>
          Pas encore de compte ?{' '}
          <Link to="/signup" state={{ from: location.state?.from }} className="font-semibold text-primary-500 hover:text-primary-600">
            Créer un compte
          </Link>
        </span>
      }
    >
      {banner && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{banner}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-primary-500 hover:text-primary-600">
            Mot de passe oublié ?
          </Link>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          {isLoading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </AuthLayout>
  )
}
