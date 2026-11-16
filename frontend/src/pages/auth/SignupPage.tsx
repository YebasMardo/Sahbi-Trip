import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import FormField from '../../components/auth/FormField'
import { applyServerErrors } from '../../features/auth/applyServerErrors'
import { useRegisterMutation } from '../../features/auth/auth.apiSlice'
import { registerSchema, type RegisterFormValues } from '../../features/auth/validation'

export default function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
  const [signup, { isLoading }] = useRegisterMutation()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterFormValues) {
    setBanner(null)
    try {
      await signup(values).unwrap()
      navigate('/verify-email', { state: { from } })
    } catch (error) {
      setBanner(applyServerErrors(error as FetchBaseQueryError | SerializedError, setError))
    }
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Planifiez votre prochain voyage au Maroc."
      footer={
        <span>
          Déjà un compte ?{' '}
          <Link to="/login" state={{ from: location.state?.from }} className="font-semibold text-primary-500 hover:text-primary-600">
            Se connecter
          </Link>
        </span>
      }
    >
      {banner && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{banner}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          label="Nom complet"
          type="text"
          autoComplete="name"
          error={errors.fullname?.message}
          {...register('fullname')}
        />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          {isLoading ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>
    </AuthLayout>
  )
}
