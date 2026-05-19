import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PageHero from '../../components/marketing/primitives/PageHero'
import Section from '../../components/marketing/primitives/Section'
import SectionHeading from '../../components/marketing/primitives/SectionHeading'
import Eyebrow from '../../components/marketing/primitives/Eyebrow'
import FadeIn from '../../components/marketing/primitives/FadeIn'
import { getLucideIcon } from '../../components/marketing/iconMap'
import { ABOUT_PAGE } from '../../content/marketing/aboutPage'

export default function AboutPage() {
  const { story, values, legal } = ABOUT_PAGE

  return (
    <>
      <Helmet>
        <title>About | New Frontiers Talent</title>
        <meta
          name="description"
          content="New Frontiers Talent is the specialist recruitment services brand of New Frontiers Business Consultancy (NFBC)."
        />
      </Helmet>

      <PageHero
        eyebrow={ABOUT_PAGE.hero.eyebrow}
        title={ABOUT_PAGE.hero.title}
        subhead={ABOUT_PAGE.hero.subhead}
      />

      {/* Story */}
      <Section>
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <Eyebrow>{story.eyebrow}</Eyebrow>
            {story.paragraphs.map((p, i) => (
              <p key={i} className="mt-6 text-lg text-foreground/90 leading-relaxed">
                {p.startsWith('TODO:') ? (
                  <span className="text-muted-foreground italic">{p}</span>
                ) : (
                  p
                )}
              </p>
            ))}
          </FadeIn>
        </div>
      </Section>

      {/* Values */}
      <Section className="bg-muted/30 border-y border-border">
        <SectionHeading
          eyebrow={values.eyebrow}
          title="The principles behind how we work."
          align="center"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {values.items.map((item, index) => {
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

      {/* Legal entity */}
      <Section>
        <FadeIn>
          <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-card p-8 text-center">
            <Eyebrow>{legal.eyebrow}</Eyebrow>
            <h3 className="mt-4 text-xl font-semibold text-foreground">Legal entity</h3>
            <p className="mt-4 text-muted-foreground leading-relaxed">{legal.body}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Registered office: [PLACEHOLDER — Mustafa to fill]
            </p>
          </div>
        </FadeIn>
      </Section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
              Want to talk?
            </h2>
            <div className="mt-8">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Contact us
                <ArrowRight size={16} />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
