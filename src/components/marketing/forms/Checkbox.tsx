import { Check } from 'lucide-react'

interface CheckboxProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
}

export default function Checkbox({ id, checked, onChange, label }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer group">
      <span className="relative shrink-0 mt-0.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={`flex items-center justify-center w-5 h-5 rounded border transition-colors ${
            checked
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-input bg-card group-hover:border-primary/40'
          }`}
        >
          {checked && <Check size={12} strokeWidth={3} />}
        </span>
      </span>
      <span className="text-sm text-muted-foreground leading-relaxed">{label}</span>
    </label>
  )
}
