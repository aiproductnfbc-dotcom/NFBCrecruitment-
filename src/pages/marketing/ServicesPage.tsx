import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import PageHero from '../../components/marketing/primitives/PageHero'
import Section from '../../components/marketing/primitives/Section'
import FadeIn from '../../components/marketing/primitives/FadeIn'
import FAQ from '../../components/marketing/primitives/FAQ'
import { getLucideIcon } from '../../components/marketing/iconMap'
import { SERVICES } from '../../content/marketing/services'

const SERVICES_FAQ = [
  {
    q: 'How long does a typical search take?',
    a: 'It depends on the seniority and specialisation of the role. Most permanent searches produce a shortlist within 5–10 business days. Executive searches and highly specialised roles can take 3–6 weeks.',
  },
  {
    q: 'How do you charge?',
    a: 'Fees are agreed per engagement and depend on the service — contingent for most permanent roles, retained for executive search and RPO. We are transparent about costs before any work begins.',
  },
  {
    q: 'Can you support international hires?',
    a: 'Yes. We regularly recruit across borders within the Middle East and beyond. We can advise on relocation considerations, though visa and immigration processing is typically managed by the employer.',
  },
  {
    q: "What if a placement doesn't work out?",
    a: 'Every placement comes with a replacement guarantee. If a hire leaves within the guarantee period, we re-run the search at no additional fee. The exact terms are agreed per engagement.',
  },
]

function ServiceNav() {
  const handleClick = (slug: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(slug)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
      window.history.replaceState(null, '', `#${slug}`)
    }
  }

  return (
    <div className="sticky top-16 z-10 border-y border-border bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex gap-2 py-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {SERVICES.map(s => (
            <a
              key={s.slug}
              href={`#${s.slug}`}
              onClick={handleClick(s.slug)}
              className="shrink-0 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function ServiceDetail({ service, index }: { service: typeof SERVICES[number]; index: number }) {
  const Icon = getLucideIcon(service.icon)
  const tinted = index % 2 === 1

  return (
    <Section
      id={service.slug}
      className={`scroll-mt-24 ${tinted ? 'bg-muted/30 border-y border-border' : ''}`}
    >
      <FadeIn>
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-16">
          <div className="lg:sticky lg:top-32 self-start">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
              <Icon size={24} />
            </div>
            <h2 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              {service.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{service.tagline}</p>
          </div>

          <div>
            <p className="text-lg text-foreground/90 leading-relaxed">
              {service.heroBlurb}
            </p>

            <div className="mt-10">
              <span className="text-primary text-xs font-medium uppercase tracking-[0.2em]">
                Who it's for
              </span>
              <ul className="mt-4 space-y-3">
                {service.whoItsFor.map((item, i) => (
                  <li key={i} className="flex gap-3 text-muted-foreground">
                    <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10">
              <span className="text-primary text-xs font-medium uppercase tracking-[0.2em]">
                What you get
              </span>
              <ul className="mt-4 space-y-3">
                {service.whatYouGet.map((item, i) => (
                  <li key={i} className="flex gap-3 text-muted-foreground">
                    <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10">
              <span className="text-primary text-xs font-medium uppercase tracking-[0.2em]">
                Ideal when
              </span>
              <div className="mt-4 rounded-lg bg-muted/30 border-l-2 border-primary/40 px-5 py-4">
                <p className="italic text-foreground/80">{service.idealWhen}</p>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </Section>
  )
}

export default function ServicesPage() {
  return (
    <>
      <Helmet>
        <title>Recruitment Services | New Frontiers Talent</title>
        <meta
          name="description"
          content="Permanent placement, contract staffing, executive search, RPO, talent mapping, and onboarding support across the Middle East and beyond."
        />
      </Helmet>

      <PageHero
        eyebrow="Services"
        title="Recruitment services, at the level you need."
        subhead="From a single hire to fully outsourced talent operations — partner with us at the level that fits your business."
        primaryCta={{ label: 'Request Talent', href: '/contact?type=hiring' }}
      />

      <ServiceNav />

      {SERVICES.map((service, i) => (
        <ServiceDetail key={service.slug} service={service} index={i} />
      ))}

      <FAQ items={SERVICES_FAQ} title="Frequently asked questions" />

      <section className="bg-primary/[0.05] border-y border-border py-16">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
              Talk to a specialist.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Tell us about the role and we'll come back with a plan.
            </p>
            <div className="mt-8">
              <Link
                to="/contact?type=hiring"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Request Talent
                <ArrowRight size={16} />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
