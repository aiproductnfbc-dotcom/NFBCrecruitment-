interface FormSectionProps {
  title: string
  cols?: 1 | 2
  children: React.ReactNode
}

export default function FormSection({ title, cols = 2, children }: FormSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        {title}
      </h3>
      <div className={`grid gap-5 ${cols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {children}
      </div>
    </div>
  )
}
