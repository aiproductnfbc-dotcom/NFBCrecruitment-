import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Section from '../primitives/Section'
import SectionHeading from '../primitives/SectionHeading'
import FadeIn from '../primitives/FadeIn'
import { getLucideIcon } from '../iconMap'
import { DIFFERENCE } from '../../../content/marketing/difference'

export default function NfrDifference() {
  return (
    <Section id="nfr-difference">
      <SectionHeading
        eyebrow={DIFFERENCE.eyebrow}
        title={DIFFERENCE.title}
        description={DIFFERENCE.leadIn}
        align="center"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {DIFFERENCE.pillars.map((pillar, index) => {
          const Icon = getLucideIcon(pillar.icon)
          const featured = 'featured' in pillar && pillar.featured

          return (
            <FadeIn key={pillar.title} delay={index * 0.05}>
              <div
                className={
                  featured
                    ? 'relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-primary/[0.04] p-6 h-full'
                    : 'rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-colors h-full'
                }
              >
                {featured && (
                  <span className="absolute top-3 right-3 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest">
                    Available to clients
                  </span>
                )}
                <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-base font-semibold text-foreground tracking-tight">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {pillar.body}
                </p>
              </div>
            </FadeIn>
          )
        })}
      </div>
      <p className="mt-12 text-center font-serif italic text-foreground/80 max-w-2xl mx-auto">
        "Behind every placement we make is a recruitment platform we built ourselves."
      </p>
      <div className="mt-6 text-center">
        <Link
          to="/clients"
          className="text-sm text-primary inline-flex items-center gap-1 hover:gap-2 transition-all"
        >
          See how it works for our clients
          <ArrowRight size={14} />
        </Link>
      </div>
    </Section>
  )
}
