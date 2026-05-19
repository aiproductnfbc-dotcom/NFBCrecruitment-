// TODO: Replace placeholder quote and attribution once we have an
// approved client testimonial. Keep length to 1–3 sentences.

import { Quote } from 'lucide-react'
import Section from '../primitives/Section'
import FadeIn from '../primitives/FadeIn'
import { TESTIMONIAL } from '../../../content/marketing/testimonial'

export default function Testimonial() {
  return (
    <Section id="testimonial" className="bg-muted/20">
      <FadeIn>
        <div className="max-w-3xl mx-auto text-center">
          <Quote size={32} className="text-primary opacity-60 mx-auto" aria-hidden="true" />
          <blockquote className="mt-6 font-serif text-2xl md:text-3xl italic text-foreground leading-snug">
            "{TESTIMONIAL.quote}"
          </blockquote>
          <p className="mt-8 text-sm text-muted-foreground">
            <span className="text-foreground font-medium">
              {TESTIMONIAL.attribution.name}
            </span>
            {' · '}
            {TESTIMONIAL.attribution.role}, {TESTIMONIAL.attribution.company}
          </p>
        </div>
      </FadeIn>
    </Section>
  )
}
