import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import FormField from '../../components/auth/FormField'
import { applyServerErrors } from '../../features/auth/applyServerErrors'
import { useResetPasswordMutation } from '../../features/auth/auth.apiSlice'
import { selectOtpToken } from '../../features/auth/auth.slice'
import { resetPasswordSchema, type ResetPasswordFormValues } from '../../features/auth/validation'
import { useAppSelector } from '../../store'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const otpToken = useAppSelector(selectOtpToken)
  const [resetPassword, { isLoading }] = useResetPasswordMutation()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) })

  // Only reachable right after forgot-password — not persisted across reloads.
  if (!otpToken) return <Navigate to="/forgot-password" replace />

  async function onSubmit(values: ResetPasswordFormValues) {
    setBanner(null)
    try {
      // No auto-login on reset — the backend only returns a confirmation message.
      await resetPassword({ token: otpToken as string, ...values }).unwrap()
      navigate('/login')
    } catch (error) {
      setBanner(applyServerErrors(error as FetchBaseQueryError | SerializedError, setError))
    }
  }

  return (
    <AuthLayout title="Réinitialiser le mot de passe" subtitle="Entrez le code reçu et votre nouveau mot de passe.">
      {banner && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{banner}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          label="Code de vérification"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          error={errors.code?.message}
          {...register('code')}
        />
        <FormField
          label="Nouveau mot de passe"
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
          {isLoading ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
        </button>
      </form>
    </AuthLayout>
  )
}
