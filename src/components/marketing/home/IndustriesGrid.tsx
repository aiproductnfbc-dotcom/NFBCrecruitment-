import { Link } from 'react-router-dom'
import Section from '../primitives/Section'
import SectionHeading from '../primitives/SectionHeading'
import FadeIn from '../primitives/FadeIn'
import { getLucideIcon } from '../iconMap'
import { INDUSTRIES } from '../../../content/marketing/industries'

export default function IndustriesGrid() {
  return (
    <Section id="industries" className="bg-muted/30 border-y border-border">
      <SectionHeading
        eyebrow="Industries"
        title="Sectors we know inside out"
        description="Specialist recruiters with deep networks across the markets that matter."
        align="center"
      />
      <FadeIn>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {INDUSTRIES.map(industry => {
            const Icon = getLucideIcon(industry.icon)
            return (
              <div
                key={industry.slug}
                className="rounded-xl border border-border bg-card px-4 py-4 flex items-center gap-3 text-sm font-medium text-foreground hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <Icon size={18} className="text-primary shrink-0" />
                <span className="truncate">{industry.name}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't see yours?{' '}
          <Link to="/industries" className="text-primary hover:underline font-medium">
            We probably cover it too &rarr;
          </Link>
        </p>
      </FadeIn>
    </Section>
  )
}
