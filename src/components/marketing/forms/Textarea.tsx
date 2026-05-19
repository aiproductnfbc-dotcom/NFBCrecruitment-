import { forwardRef } from 'react'
import { FIELD_BASE, FIELD_ERROR } from './fieldStyles'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', rows = 5, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`${FIELD_BASE} resize-none ${error ? FIELD_ERROR : ''} ${className}`}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'
export default Textarea
