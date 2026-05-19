import { forwardRef } from 'react'
import { FIELD_BASE, FIELD_ERROR } from './fieldStyles'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`${FIELD_BASE} ${error ? FIELD_ERROR : ''} ${className}`}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
export default Input
