import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Eyebrow from '../primitives/Eyebrow'
import FadeIn from '../primitives/FadeIn'
import { HERO } from '../../../content/marketing/home'

function HeroIllustration() {
  return (
    <div className="relative hidden md:block" aria-hidden="true">
      {/* Floating accent: candidates pill */}
      <div className="absolute -top-4 -left-6 z-10 rounded-xl border border-border bg-card px-4 py-2.5 shadow-md">
        <p className="text-xs font-medium text-muted-foreground">This week</p>
        <p className="text-lg font-semibold text-foreground">+12 candidates</p>
        <div className="mt-1 flex gap-0.5">
          {[40, 65, 50, 80, 70, 90, 75].map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-primary/30"
              style={{ height: `${h * 0.24}px` }}
            />
          ))}
        </div>
      </div>

      {/* Main pipeline card */}
      <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur shadow-lg p-6 lg:-rotate-2">
        <div className="grid grid-cols-3 gap-4">
          {/* Column: Sourced */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40" />
              Sourced
            </div>
            <div className="space-y-2">
              <CandidateCard initials="AK" name="A. Khalil" role="Senior Engineer" color="bg-secondary/20 text-secondary" />
              <CandidateCard initials="SR" name="S. Rahman" role="Product Lead" color="bg-accent text-accent-foreground" />
            </div>
          </div>

          {/* Column: Interview */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-secondary" />
              Interview
            </div>
            <div className="space-y-2">
              <CandidateCard initials="MJ" name="M. Jaber" role="Finance Manager" color="bg-secondary/20 text-secondary" />
            </div>
          </div>

          {/* Column: Offer */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              <span className="text-primary">Offer</span>
            </div>
            <div className="space-y-2">
              <CandidateCard initials="LN" name="L. Nasser" role="Operations Dir." color="bg-primary/15 text-primary" badge="Accepted" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating accent: success badge */}
      <div className="absolute -bottom-3 -right-4 z-10 rounded-xl border border-border bg-card px-4 py-2.5 shadow-md flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15">
          <ArrowRight size={12} className="text-primary rotate-[-45deg]" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Time to fill</p>
          <p className="text-sm font-semibold text-foreground">18 days avg</p>
        </div>
      </div>
    </div>
  )
}

function CandidateCard({
  initials,
  name,
  role,
  color,
  badge,
}: {
  initials: string
  name: string
  role: string
  color: string
  badge?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-center gap-2">
        <span className={`flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold shrink-0 ${color}`}>
          {initials}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{role}</p>
        </div>
      </div>
      {badge && (
        <span className="mt-1.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary">
          {badge}
        </span>
      )}
    </div>
  )
}

export default function Hero() {
  // Split headline to wrap the accent phrase
  const parts = HERO.headline.split(HERO.headlineAccent)

  return (
    <section className="relative overflow-hidden pt-24 md:pt-32 pb-20 md:pb-28">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 70% 20%, var(--primary) 0%, transparent 70%)',
          opacity: 0.06,
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column: text */}
          <FadeIn>
            <div>
              <Eyebrow>{HERO.eyebrow}</Eyebrow>
              <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-foreground leading-[1.05]">
                {parts[0]}
                <span className="text-primary">{HERO.headlineAccent}</span>
                {parts[1]}
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
                {HERO.subheadline}
              </p>
              <div className="mt-10 flex gap-3 flex-wrap">
                <Link
                  to={HERO.primaryCta.href}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {HERO.primaryCta.label}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to={HERO.secondaryCta.href}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  {HERO.secondaryCta.label}
                </Link>
              </div>
            </div>
          </FadeIn>

          {/* Right column: visual */}
          <FadeIn delay={0.1}>
            <HeroIllustration />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
