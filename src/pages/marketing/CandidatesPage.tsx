import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PageHero from '../../components/marketing/primitives/PageHero'
import Section from '../../components/marketing/primitives/Section'
import SectionHeading from '../../components/marketing/primitives/SectionHeading'
import FadeIn from '../../components/marketing/primitives/FadeIn'
import FAQ from '../../components/marketing/primitives/FAQ'
import { getLucideIcon } from '../../components/marketing/iconMap'
import { CANDIDATES_PAGE } from '../../content/marketing/candidatesPage'

export default function CandidatesPage() {
  const { promise, process, faq } = CANDIDATES_PAGE

  return (
    <>
      <Helmet>
        <title>For Candidates | New Frontiers Talent</title>
        <meta
          name="description"
          content="Apply to open roles or submit your CV. NFT works with serious employers across multiple sectors."
        />
      </Helmet>

      <PageHero
        eyebrow={CANDIDATES_PAGE.hero.eyebrow}
        title={CANDIDATES_PAGE.hero.title}
        subhead={CANDIDATES_PAGE.hero.subhead}
        primaryCta={CANDIDATES_PAGE.hero.primaryCta}
        secondaryCta={CANDIDATES_PAGE.hero.secondaryCta}
      />

      {/* Promise grid */}
      <Section>
        <SectionHeading
          eyebrow={promise.eyebrow}
          title="What you can expect from us."
          align="center"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {promise.items.map((item, index) => {
            const Icon = getLucideIcon(item.icon)
            return (
              <FadeIn key={item.title} delay={index * 0.05}>
                <div className="rounded-2xl border border-border bg-card p-6 h-full">
                  <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </Section>

      {/* Process timeline */}
      <Section className="bg-muted/30 border-y border-border">
        <SectionHeading
          eyebrow={process.eyebrow}
          title={process.title}
          align="center"
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {process.steps.map((step, index) => (
            <FadeIn key={step.number} delay={index * 0.06}>
              <div>
                <span className="font-mono text-sm text-primary tracking-widest">
                  {step.number}
                </span>
                <h3 className="mt-3 text-base font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* Dual CTA */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <FadeIn>
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-10 h-full">
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
                Found a role?
              </h2>
              <p className="mt-3 text-muted-foreground">
                Apply directly. No account needed.
              </p>
              <div className="mt-8">
                <Link
                  to="/jobs"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Browse Open Roles
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.08}>
            <div className="rounded-2xl border border-border bg-card p-10 h-full">
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
                Nothing fits today?
              </h2>
              <p className="mt-3 text-muted-foreground">
                Send your CV anyway. We'll keep you in mind.
              </p>
              <div className="mt-8">
                <Link
                  to="/contact?type=candidate"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Submit your CV
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </Section>

      <FAQ items={faq} eyebrow="Questions" title="Frequently asked." />
    </>
  )
}
