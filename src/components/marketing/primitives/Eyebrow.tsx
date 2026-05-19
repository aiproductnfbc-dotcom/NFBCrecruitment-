interface EyebrowProps {
  children: React.ReactNode
  className?: string
}

export default function Eyebrow({ children, className = '' }: EyebrowProps) {
  return (
    <span className={`text-primary text-xs font-medium uppercase tracking-[0.2em] ${className}`}>
      {children}
    </span>
  )
}
