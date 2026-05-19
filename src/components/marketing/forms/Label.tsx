interface LabelProps {
  htmlFor?: string
  required?: boolean
  children: React.ReactNode
}

export default function Label({ htmlFor, required, children }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground mb-1.5">
      {children}
      {required && <span className="text-primary ml-0.5">*</span>}
    </label>
  )
}
