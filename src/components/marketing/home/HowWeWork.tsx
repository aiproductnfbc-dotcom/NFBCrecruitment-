import Section from '../primitives/Section'
import SectionHeading from '../primitives/SectionHeading'
import FadeIn from '../primitives/FadeIn'
import { getLucideIcon } from '../iconMap'
import { PROCESS_STEPS } from '../../../content/marketing/process'

export default function HowWeWork() {
  return (
    <Section id="how-we-work">
      <SectionHeading
        eyebrow="How we work"
        title="A simple, deliberate process."
        description="Four steps. No black box. You'll know exactly where every search stands."
        align="center"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {PROCESS_STEPS.map((step, index) => {
          const Icon = getLucideIcon(step.icon)
          return (
            <FadeIn key={step.number} delay={index * 0.08}>
              <div className="relative">
                <span className="font-mono text-sm text-primary tracking-widest">
                  {step.number}
                </span>
                <div className="mt-4 flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                  <Icon size={22} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </FadeIn>
          )
        })}
      </div>
    </Section>
  )
}
