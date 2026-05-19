import Eyebrow from './Eyebrow'

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}: SectionHeadingProps) {
  const centered = align === 'center'

  return (
    <div className={centered ? 'text-center mb-14' : 'mb-14'}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        className={`mt-4 text-3xl md:text-5xl font-semibold text-foreground tracking-tight ${
          centered ? '' : ''
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl ${
            centered ? 'mx-auto' : ''
          }`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
