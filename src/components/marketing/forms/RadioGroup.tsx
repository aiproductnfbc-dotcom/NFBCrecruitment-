interface RadioGroupProps {
  name: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  orientation?: 'horizontal' | 'vertical'
}

export default function RadioGroup({
  name,
  value,
  onChange,
  options,
  orientation = 'vertical',
}: RadioGroupProps) {
  return (
    <div
      className={`flex gap-2 ${orientation === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col'}`}
      role="radiogroup"
    >
      {options.map(opt => {
        const checked = value === opt.value
        return (
          <label
            key={opt.value}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
              checked
                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                : 'border-input bg-card hover:border-primary/40'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span className="text-sm font-medium text-foreground">{opt.label}</span>
          </label>
        )
      })}
    </div>
  )
}
