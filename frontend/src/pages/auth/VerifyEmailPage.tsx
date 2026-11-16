import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import FormField from '../../components/auth/FormField'
import { applyServerErrors } from '../../features/auth/applyServerErrors'
import { useResendOtpMutation, useVerifyEmailMutation } from '../../features/auth/auth.apiSlice'
import { selectOtpToken } from '../../features/auth/auth.slice'
import { verifyEmailSchema, type VerifyEmailFormValues } from '../../features/auth/validation'
import { useAppSelector } from '../../store'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  const otpToken = useAppSelector(selectOtpToken)
  const [verifyEmail, { isLoading }] = useVerifyEmailMutation()
  const [resendOtp, { isLoading: isResending }] = useResendOtpMutation()
  const [banner, setBanner] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VerifyEmailFormValues>({ resolver: zodResolver(verifyEmailSchema) })

  // No otpToken (fresh page load, e.g. after a reload) — the flow is only
  // reachable right after register/login, never persisted across reloads.
  if (!otpToken) return <Navigate to="/login" replace />

  async function onSubmit(values: VerifyEmailFormValues) {
    setBanner(null)
    try {
      await verifyEmail({ token: otpToken as string, ...values }).unwrap()
      navigate(from, { replace: true })
    } catch (error) {
      setBanner(applyServerErrors(error as FetchBaseQueryError | SerializedError, setError))
    }
  }

  async function onResend() {
    setBanner(null)
    setResendMessage(null)
    try {
      const result = await resendOtp({ token: otpToken as string }).unwrap()
      setResendMessage(result.data.message)
    } catch (error) {
      // No form field to bind on this action — only the banner message is used.
      setBanner(applyServerErrors<VerifyEmailFormValues>(error as FetchBaseQueryError | SerializedError, () => {}))
    }
  }

  return (
    <AuthLayout title="Vérifiez votre email" subtitle="Entrez le code à 6 chiffres reçu par email.">
      {banner && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{banner}</div>}
      {resendMessage && (
        <div className="mb-4 rounded-xl bg-teal-50 px-4 py-2.5 text-sm text-teal-600">{resendMessage}</div>
      )}
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
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          {isLoading ? 'Vérification…' : 'Vérifier'}
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={isResending}
          className="text-sm font-medium text-primary-500 hover:text-primary-600 disabled:opacity-50"
        >
          {isResending ? 'Envoi…' : 'Renvoyer le code'}
        </button>
      </form>
    </AuthLayout>
  )
}
