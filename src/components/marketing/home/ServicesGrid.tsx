import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Section from '../primitives/Section'
import SectionHeading from '../primitives/SectionHeading'
import FadeIn from '../primitives/FadeIn'
import { getLucideIcon } from '../iconMap'
import { SERVICES } from '../../../content/marketing/services'

function ServiceCard({ service, index }: { service: typeof SERVICES[number]; index: number }) {
  const Icon = getLucideIcon(service.icon)

  return (
    <FadeIn delay={index * 0.05}>
      <Link
        to={`/services#${service.slug}`}
        className="group block rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 h-full"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
          <Icon size={24} />
        </div>
        <h3 className="mt-6 text-xl font-semibold text-foreground tracking-tight">
          {service.title}
        </h3>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          {service.blurb}
        </p>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
          Learn more
          <ArrowRight
            size={14}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </span>
      </Link>
    </FadeIn>
  )
}

export default function ServicesGrid() {
  return (
    <Section id="services">
      <SectionHeading
        eyebrow="What we do"
        title="Recruitment services, end to end"
        description="From a single hire to fully outsourced talent operations — partner with us at the level that fits your business."
        align="center"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SERVICES.map((service, i) => (
          <ServiceCard key={service.slug} service={service} index={i} />
        ))}
      </div>
    </Section>
  )
}
