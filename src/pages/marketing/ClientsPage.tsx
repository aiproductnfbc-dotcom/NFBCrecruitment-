import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import PageHero from '../../components/marketing/primitives/PageHero'
import Section from '../../components/marketing/primitives/Section'
import SectionHeading from '../../components/marketing/primitives/SectionHeading'
import FadeIn from '../../components/marketing/primitives/FadeIn'
import FAQ from '../../components/marketing/primitives/FAQ'
import { getLucideIcon } from '../../components/marketing/iconMap'
import { CLIENTS_PAGE } from '../../content/marketing/clientsPage'

function PortalMockup() {
  return (
    <div className="relative hidden md:block" aria-hidden="true">
      {/* Floating accent: feedback submitted */}
      <div className="absolute -top-3 -left-4 z-10 rounded-xl border border-border bg-card px-4 py-2.5 shadow-md flex items-center gap-2 rotate-[-2deg]">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15">
          <CheckCircle2 size={12} className="text-primary" />
        </span>
        <div>
          <p className="text-xs font-medium text-foreground">Interview feedback submitted</p>
          <p className="text-[10px] text-muted-foreground">2 min ago</p>
        </div>
      </div>

      {/* Main portal frame */}
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
          </div>
          <div className="flex-1 flex justify-center">
            <span className="rounded-full bg-muted/50 border border-border px-4 py-0.5 font-mono text-[10px] text-muted-foreground">
              portal.newfrontiers.com
            </span>
          </div>
        </div>

        {/* Portal content */}
        <div className="p-5">
          {/* Portal header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Acme Corp</p>
              <p className="text-[10px] text-muted-foreground">4 open roles</p>
            </div>
            <span className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary">
              AC
            </span>
          </div>

          {/* Mock role cards */}
          <div className="space-y-3">
            {[
              { title: 'Senior Software Engineer', location: 'Amman', filled: 3, total: 4, candidates: 5, update: '2h ago' },
              { title: 'Finance Manager', location: 'Dubai', filled: 2, total: 4, candidates: 3, update: '1d ago' },
              { title: 'Project Director', location: 'Riyadh', filled: 1, total: 4, candidates: 8, update: '4h ago' },
            ].map((role) => (
              <div key={role.title} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">{role.title}</p>
                  <p className="text-[10px] text-muted-foreground">{role.location}</p>
                </div>
                <div className="flex gap-0.5 mt-2">
                  {Array.from({ length: role.total }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i < role.filled ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {role.candidates} candidates · last update {role.update}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center">
            <span className="rounded-full border border-primary/40 px-3 py-1 text-[10px] font-medium text-primary">
              View shortlist &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Floating accent: pipeline stats */}
      <div className="absolute -bottom-3 -right-4 z-10 rounded-xl border border-border bg-card px-4 py-2.5 shadow-md rotate-[2deg]">
        <div className="flex gap-3">
          {[40, 70, 55, 85].map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="w-2 rounded-full bg-primary/30"
                style={{ height: `${h * 0.28}px` }}
              />
              <span className="text-[8px] text-muted-foreground">W{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ClientsPage() {
  const { partnership, portal, faq } = CLIENTS_PAGE

  return (
    <>
      <Helmet>
        <title>For Clients | New Frontiers Talent</title>
        <meta
          name="description"
          content="Partner with NFT for specialist recruitment services, with a real-time Client Portal that gives you live visibility into shortlists, interviews, and placements."
        />
      </Helmet>

      <PageHero
        eyebrow={CLIENTS_PAGE.hero.eyebrow}
        title={CLIENTS_PAGE.hero.title}
        subhead={CLIENTS_PAGE.hero.subhead}
        primaryCta={CLIENTS_PAGE.hero.primaryCta}
        secondaryCta={CLIENTS_PAGE.hero.secondaryCta}
      />

      {/* Partnership pillars */}
      <Section>
        <SectionHeading
          eyebrow={partnership.eyebrow}
          title={partnership.title}
          align="center"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {partnership.pillars.map((pillar, index) => {
            const Icon = getLucideIcon(pillar.icon)
            return (
              <FadeIn key={pillar.title} delay={index * 0.05}>
                <div className="rounded-2xl border border-border bg-card p-7 h-full">
                  <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
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
      </Section>

      {/* Portal feature block */}
      <Section className="bg-muted/20 border-y border-border">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5">
            <FadeIn>
              <span className="text-primary text-xs font-medium uppercase tracking-[0.2em]">
                {portal.eyebrow}
              </span>
              <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight text-foreground">
                {portal.title}
              </h2>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                {portal.leadIn}
              </p>
              <div className="mt-10 space-y-6">
                {portal.capabilities.map(cap => {
                  const CapIcon = getLucideIcon(cap.icon)
                  return (
                    <div key={cap.title} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                      <CapIcon size={20} className="text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{cap.title}</p>
                        <p className="text-sm text-muted-foreground">{cap.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </FadeIn>
          </div>

          <div className="lg:col-span-7">
            <FadeIn delay={0.1}>
              <PortalMockup />
            </FadeIn>
          </div>
        </div>

        {/* Trust row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 pt-10 border-t border-border">
          {portal.trust.map(item => {
            const TrustIcon = getLucideIcon(item.icon)
            return (
              <FadeIn key={item.title}>
                <div className="flex items-start gap-3">
                  <TrustIcon size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                  </div>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </Section>

      <FAQ items={faq} eyebrow="Questions" title="Common questions from clients." />

      {/* Final CTA */}
      <section className="bg-primary/[0.05] border-y border-border py-16">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
              Ready to partner?
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Tell us what you're hiring for and we'll come back with a plan within 48 hours.
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
