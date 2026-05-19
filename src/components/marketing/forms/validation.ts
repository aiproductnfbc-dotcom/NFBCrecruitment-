export type FieldErrors = Record<string, string | undefined>

export function validateRequired(value: string | undefined, label: string): string | undefined {
  if (!value || value.trim().length === 0) return `${label} is required.`
  return undefined
}

export function validateEmail(value: string): string | undefined {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.'
  return undefined
}

export function validatePhone(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.length < 6 || value.length > 30) return 'Please enter a valid phone number.'
  return undefined
}

export function validateMaxLength(value: string | undefined, max: number, label: string): string | undefined {
  if (!value) return undefined
  if (value.length > max) return `${label} must be ${max} characters or fewer.`
  return undefined
}
