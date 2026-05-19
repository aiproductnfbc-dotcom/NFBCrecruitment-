import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { FIELD_BASE, FIELD_ERROR } from './fieldStyles'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  placeholder?: string
  options: { value: string; label: string }[]
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, placeholder = '— Select an option —', options, className = '', ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={`${FIELD_BASE} appearance-none pr-10 ${error ? FIELD_ERROR : ''} ${className}`}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
      </div>
    )
  }
)

Select.displayName = 'Select'
export default Select
