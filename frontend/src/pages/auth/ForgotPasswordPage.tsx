import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import FormField from '../../components/auth/FormField'
import { applyServerErrors } from '../../features/auth/applyServerErrors'
import { useForgotPasswordMutation } from '../../features/auth/auth.apiSlice'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../../features/auth/validation'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) })

  async function onSubmit(values: ForgotPasswordFormValues) {
    setBanner(null)
    try {
      await forgotPassword(values).unwrap()
      navigate('/reset-password')
    } catch (error) {
      setBanner(applyServerErrors(error as FetchBaseQueryError | SerializedError, setError))
    }
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Entrez votre email, nous vous envoyons un code de réinitialisation."
      footer={
        <Link to="/login" className="font-semibold text-primary-500 hover:text-primary-600">
          Retour à la connexion
        </Link>
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
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          {isLoading ? 'Envoi…' : 'Envoyer le code'}
        </button>
      </form>
    </AuthLayout>
  )
}
