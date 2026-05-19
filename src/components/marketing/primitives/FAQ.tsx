import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Section from './Section'
import SectionHeading from './SectionHeading'
import FadeIn from './FadeIn'

interface FAQProps {
  items: readonly { q: string; a: string }[]
  title?: string
  eyebrow?: string
}

export default function FAQ({ items, title, eyebrow }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <Section>
      {(title || eyebrow) && (
        <SectionHeading
          eyebrow={eyebrow}
          title={title || 'Frequently asked questions'}
          align="center"
        />
      )}
      <FadeIn>
        <div className="max-w-3xl mx-auto divide-y divide-border">
          {items.map((item, index) => {
            const isOpen = openIndex === index
            return (
              <div key={index}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-medium text-foreground">
                    {item.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen ? 'max-h-96 pb-5' : 'max-h-0'
                  }`}
                >
                  <p className="text-muted-foreground leading-relaxed pr-8">
                    {item.a}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </FadeIn>
    </Section>
  )
}
