import Label from './Label'
import FormError from './FormError'

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}

export default function FormField({ id, label, required, error, hint, children }: FormFieldProps) {
  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error && <FormError>{error}</FormError>}
      {!error && hint && (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
