import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Eyebrow from './Eyebrow'
import FadeIn from './FadeIn'

interface PageHeroProps {
  eyebrow: string
  title: string
  subhead: string
  primaryCta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  align?: 'left' | 'center'
}

export default function PageHero({
  eyebrow,
  title,
  subhead,
  primaryCta,
  secondaryCta,
  align = 'left',
}: PageHeroProps) {
  const centered = align === 'center'

  return (
    <section className="relative pt-24 md:pt-32 pb-16 md:pb-20">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, var(--primary) 0%, transparent 70%)',
          opacity: 0.05,
        }}
      />
      <div className={`relative mx-auto max-w-4xl px-6 ${centered ? 'text-center' : ''}`}>
        <FadeIn>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.08]">
            {title}
          </h1>
          <p
            className={`mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed ${
              centered ? 'mx-auto' : ''
            }`}
          >
            {subhead}
          </p>
          {(primaryCta || secondaryCta) && (
            <div className={`mt-10 flex gap-3 flex-wrap ${centered ? 'justify-center' : ''}`}>
              {primaryCta && (
                <Link
                  to={primaryCta.href}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {primaryCta.label}
                  <ArrowRight size={16} />
                </Link>
              )}
              {secondaryCta && (
                <Link
                  to={secondaryCta.href}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  {secondaryCta.label}
                </Link>
              )}
            </div>
          )}
        </FadeIn>
      </div>
    </section>
  )
}
