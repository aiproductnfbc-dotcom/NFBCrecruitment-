import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Section from '../primitives/Section'
import FadeIn from '../primitives/FadeIn'
import { SPLIT_CTA } from '../../../content/marketing/splitCta'

export default function SplitCta() {
  const { hiring, candidates } = SPLIT_CTA

  return (
    <Section id="split-cta">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FadeIn>
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-10 h-full">
            <span className="text-primary text-xs font-medium uppercase tracking-[0.2em]">
              {hiring.eyebrow}
            </span>
            <h2 className="mt-4 text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              {hiring.title}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md">
              {hiring.body}
            </p>
            <div className="mt-8">
              <Link
                to={hiring.ctaHref}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {hiring.ctaLabel}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.08}>
          <div className="rounded-2xl border border-border bg-card p-10 h-full">
            <span className="text-foreground/60 text-xs font-medium uppercase tracking-[0.2em]">
              {candidates.eyebrow}
            </span>
            <h2 className="mt-4 text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              {candidates.title}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md">
              {candidates.body}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={candidates.ctaHref}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {candidates.ctaLabel}
                <ArrowRight size={16} />
              </Link>
              <Link
                to={candidates.ctaSecondaryHref}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                {candidates.ctaSecondaryLabel}
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  )
}
