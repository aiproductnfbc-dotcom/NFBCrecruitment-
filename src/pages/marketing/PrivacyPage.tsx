import { Helmet } from 'react-helmet-async'
import PageHero from '../../components/marketing/primitives/PageHero'
import Section from '../../components/marketing/primitives/Section'
import FadeIn from '../../components/marketing/primitives/FadeIn'

export default function PrivacyPage() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | New Frontiers Talent</title>
        <meta name="description" content="Privacy policy for New Frontiers Talent (NFT), a service of New Frontiers Business Consultancy (NFBC)." />
      </Helmet>

      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        subhead="Effective date: TBD"
      />

      <Section>
        <FadeIn>
          <article className="max-w-3xl mx-auto">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground mb-10">
              Placeholder content. Final policy under legal review.
            </div>

            {/* Who we are */}
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">Who we are</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              New Frontiers Talent (NFT) is the recruitment services brand of New Frontiers Business Consultancy (NFBC). When we refer to "we", "us", or "our" in this policy, we mean NFBC.
            </p>
            {/* TODO: Add registered address and jurisdiction */}

            {/* What data we collect */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">What data we collect</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We collect personal data that you provide when you apply for a role, submit your CV, or contact us through our website. This may include your name, email address, phone number, employment history, and any information contained in your CV or cover letter.
            </p>
            {/* TODO: Expand with full data categories */}

            {/* How we use it */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">How we use your data</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We use your data to match you with suitable roles, communicate with you about opportunities, and manage our recruitment process. We do not sell your data to third parties. Candidate data is shared with prospective employers only with your explicit consent.
            </p>
            {/* TODO: Detail legal bases for processing */}

            {/* Cookies */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">Cookies</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Our website uses essential cookies required for the site to function. We may also use analytics cookies to understand how visitors interact with our site. You can control cookie preferences through your browser settings.
            </p>
            {/* TODO: Add specific cookie table */}

            {/* Your rights */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">Your rights</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              You have the right to access, correct, or delete your personal data. You may also withdraw consent for us to process your data at any time. To exercise any of these rights, please contact us using the details below.
            </p>
            {/* TODO: Specify applicable data protection regulation */}

            {/* Contact */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">Contact</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              For any privacy-related enquiries, please contact us at [PLACEHOLDER — email to be added].
            </p>
            {/* TODO: Add actual contact email and data protection officer details */}
          </article>
        </FadeIn>
      </Section>
    </>
  )
}
