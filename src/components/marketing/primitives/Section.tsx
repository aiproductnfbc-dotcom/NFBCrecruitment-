interface SectionProps {
  id?: string
  className?: string
  container?: boolean
  children: React.ReactNode
}

export default function Section({ id, className = '', container = true, children }: SectionProps) {
  return (
    <section id={id} className={`py-20 md:py-28 ${className}`}>
      {container ? (
        <div className="mx-auto max-w-6xl px-6">{children}</div>
      ) : (
        children
      )}
    </section>
  )
}
