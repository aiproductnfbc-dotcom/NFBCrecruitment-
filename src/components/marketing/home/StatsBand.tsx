import FadeIn from '../primitives/FadeIn'
import { STATS } from '../../../content/marketing/stats'

export default function StatsBand() {
  return (
    <section className="bg-foreground text-background border-t border-primary/30">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(stat => (
              <div key={stat.label}>
                <p className="text-4xl md:text-5xl font-mono font-semibold text-primary tabular-nums tracking-tight">
                  {stat.display}
                </p>
                <p className="mt-3 text-sm text-background/70 leading-tight">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
