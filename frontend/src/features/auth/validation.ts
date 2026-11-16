import { z } from 'zod'

// Client-side UX guard only — the backend DTOs (backend/src/app/auth/dto/*)
// stay the source of truth; applyServerErrors.ts still binds any 400 the
// server returns on top of whatever passed validation here.

export const registerSchema = z.object({
  fullname: z.string().trim().min(1, 'Le nom complet est obligatoire.'),
  email: z.string().trim().email('Adresse email invalide.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
})
export type RegisterFormValues = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().trim().email('Adresse email invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
})
export type LoginFormValues = z.infer<typeof loginSchema>

export const verifyEmailSchema = z.object({
  code: z.string().length(6, 'Le code doit contenir 6 chiffres.').regex(/^\d+$/, 'Le code doit contenir 6 chiffres.'),
})
export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Adresse email invalide.'),
})
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  code: z.string().length(6, 'Le code doit contenir 6 chiffres.').regex(/^\d+$/, 'Le code doit contenir 6 chiffres.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
})
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
