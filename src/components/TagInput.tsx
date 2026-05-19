import { useState } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export default function TagInput({ value, onChange, placeholder = 'Type keyword, press Enter' }: TagInputProps) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const tag = input.trim().replace(/,+$/, '')
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInput('')
  }

  const removeTag = (tag: string) => onChange(value.filter(t => t !== tag))

  return (
    <div className="flex flex-wrap gap-1.5 border border-gray-300 rounded-lg px-3 py-2 min-h-[42px] focus-within:ring-2 focus-within:ring-blue-500 cursor-text">
      {value.map(tag => (
        <span key={tag} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900 ml-0.5">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
          else if (e.key === 'Backspace' && !input && value.length) removeTag(value[value.length - 1]!)
        }}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
      />
    </div>
  )
}
