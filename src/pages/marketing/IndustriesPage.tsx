import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import PageHero from '../../components/marketing/primitives/PageHero'
import Section from '../../components/marketing/primitives/Section'
import FadeIn from '../../components/marketing/primitives/FadeIn'
import { getLucideIcon } from '../../components/marketing/iconMap'
import { INDUSTRIES } from '../../content/marketing/industries'

export default function IndustriesPage() {
  return (
    <>
      <Helmet>
        <title>Industries | New Frontiers Talent</title>
        <meta
          name="description"
          content="Specialist recruitment across technology, banking, energy, healthcare, construction, manufacturing, retail, telecommunications, government, and hospitality."
        />
      </Helmet>

      <PageHero
        eyebrow="Industries"
        title="Sectors we know inside out."
        subhead="Specialist recruiters with deep networks across the markets that matter."
      />

      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {INDUSTRIES.map((industry, index) => {
            const Icon = getLucideIcon(industry.icon)
            return (
              <FadeIn key={industry.slug} delay={index * 0.03}>
                <article
                  id={industry.slug}
                  className="scroll-mt-24 rounded-2xl border border-border bg-card p-8 transition-colors hover:border-primary/40 h-full"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary shrink-0">
                      <Icon size={24} />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      {industry.name}
                    </h2>
                  </div>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    {industry.summary}
                  </p>
                  <div className="mt-6">
                    <span className="text-primary text-xs font-medium uppercase tracking-[0.2em]">
                      Sample roles we recruit for
                    </span>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {industry.sampleRoles.map(role => (
                        <span
                          key={role}
                          className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              </FadeIn>
            )
          })}
        </div>
      </Section>

      <section className="py-12 text-center">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <p className="text-muted-foreground">
              Don't see your sector? We probably cover it too.
            </p>
            <Link
              to="/contact?type=hiring"
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary font-medium hover:gap-2 transition-all"
            >
              Talk to us
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
