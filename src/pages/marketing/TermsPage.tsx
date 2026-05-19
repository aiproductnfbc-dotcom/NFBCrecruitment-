import { Helmet } from 'react-helmet-async'
import PageHero from '../../components/marketing/primitives/PageHero'
import Section from '../../components/marketing/primitives/Section'
import FadeIn from '../../components/marketing/primitives/FadeIn'

export default function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of Service | New Frontiers Talent</title>
        <meta name="description" content="Terms of service for New Frontiers Talent (NFT), a service of New Frontiers Business Consultancy (NFBC)." />
      </Helmet>

      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        subhead="Effective date: TBD"
      />

      <Section>
        <FadeIn>
          <article className="max-w-3xl mx-auto">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground mb-10">
              Placeholder content. Final terms under legal review.
            </div>

            {/* Who we are */}
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">Who we are</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              This website is operated by New Frontiers Business Consultancy (NFBC). New Frontiers Talent (NFT) is a recruitment services brand of NFBC. References to "we", "us", or "our" refer to NFBC.
            </p>
            {/* TODO: Add registered entity details */}

            {/* Use of the site */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">Use of the site</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              By using this website, you agree to these terms. The site is provided for informational purposes and to facilitate recruitment services. You may not use the site for any unlawful purpose or in a way that could damage, disable, or impair the site.
            </p>
            {/* TODO: Expand with acceptable use policy */}

            {/* Intellectual property */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">Intellectual property</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              All content on this website — including text, graphics, logos, and software — is the property of NFBC or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from this content without our written permission.
            </p>
            {/* TODO: Add details on trademarks */}

            {/* Recruitment services */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">Recruitment services</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Our recruitment services are provided under separate engagement agreements with each client. The terms on this page govern your use of the website, not the recruitment engagement itself. Specific service terms, fees, and guarantees are agreed per engagement.
            </p>
            {/* TODO: Reference standard engagement terms */}

            {/* Limitation of liability */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">Limitation of liability</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              To the fullest extent permitted by law, NFBC shall not be liable for any indirect, incidental, or consequential damages arising from your use of this website or our services. We make no warranties about the accuracy or completeness of the information on this site.
            </p>
            {/* TODO: Review with legal counsel */}

            {/* Contact */}
            <h2 className="mt-12 text-2xl font-semibold text-foreground tracking-tight">Contact</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              For any questions about these terms, please contact us at [PLACEHOLDER — email to be added].
            </p>
            {/* TODO: Add actual contact details */}
          </article>
        </FadeIn>
      </Section>
    </>
  )
}
