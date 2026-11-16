import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { SerializedError } from '@reduxjs/toolkit'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

const GENERIC_MESSAGE = 'Une erreur est survenue. Veuillez réessayer.'
const NETWORK_MESSAGE = 'Connexion impossible. Vérifiez votre réseau et réessayez.'

interface ValidationErrorBody {
  statusCode: 400
  message: string
  errors: Record<string, string[]>
}

interface HttpExceptionBody {
  statusCode: number
  message: string
  error: string
}

function isValidationBody(data: unknown): data is ValidationErrorBody {
  return typeof data === 'object' && data !== null && 'errors' in data
}

function isHttpExceptionBody(data: unknown): data is HttpExceptionBody {
  return typeof data === 'object' && data !== null && 'message' in data
}

/**
 * Maps an RTK Query error from the backend onto a react-hook-form instance.
 *
 * Field-level 400s (ClassValidationPipe's `{ errors: { field: [msg] } }`)
 * are bound directly to the matching form field; anything else (invalid
 * credentials, expired OTP, network failure...) is returned as a message for
 * a generic banner — there is no field to attach it to.
 */
export function applyServerErrors<T extends FieldValues>(
  error: FetchBaseQueryError | SerializedError | undefined,
  setError: UseFormSetError<T>,
): string {
  if (!error) return GENERIC_MESSAGE

  if (!('status' in error)) {
    // SerializedError — thrown before a response was even attempted.
    return error.message ?? GENERIC_MESSAGE
  }

  if (error.status === 'FETCH_ERROR' || error.status === 'TIMEOUT_ERROR') {
    return NETWORK_MESSAGE
  }

  const data = error.data

  if (isValidationBody(data)) {
    for (const [field, messages] of Object.entries(data.errors)) {
      if (messages[0]) {
        setError(field as Path<T>, { type: 'server', message: messages[0] })
      }
    }
    return data.message || GENERIC_MESSAGE
  }

  if (isHttpExceptionBody(data)) {
    return data.message || GENERIC_MESSAGE
  }

  return GENERIC_MESSAGE
}
