import FadeIn from '../primitives/FadeIn'
import { TRUST_BAR } from '../../../content/marketing/home'

// Deterministic style variations per index to make placeholder wordmarks
// look like distinct brand logos without actual images.
const STYLE_VARIANTS = [
  'font-semibold',
  'font-bold uppercase text-base tracking-wider',
  'font-serif font-semibold italic',
  'font-bold',
  'font-semibold uppercase text-base',
  'font-serif font-bold',
]

export default function TrustBar() {
  // TODO: Replace placeholder wordmarks with real client logos (SVG)
  // once approved by NFT. Keep them grayscale, fixed height ~24px.
  return (
    <section className="py-12 md:py-16 border-y border-border">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <p className="text-center text-muted-foreground text-sm uppercase tracking-wider mb-8">
            {TRUST_BAR.label}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {TRUST_BAR.logos.map((logo, i) => (
              <span
                key={logo.name}
                className={`text-lg md:text-xl text-muted-foreground/50 hover:text-foreground transition-colors select-none ${STYLE_VARIANTS[i % STYLE_VARIANTS.length]}`}
              >
                {i === 2 && <span className="text-primary mr-1">&bull;</span>}
                {logo.name}
              </span>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
