import { Link } from 'react-router-dom'
import BrandMark from './BrandMark'
import { footerServices, footerCompany, footerLegal } from '../../content/marketing/nav'
import { SITE } from '../../content/marketing/site'

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <ul className="space-y-2">
        {links.map(link => (
          <li key={link.href + link.label}>
            <Link
              to={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MarketingFooter() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Col 1: Brand */}
          <div className="space-y-3">
            <BrandMark />
            <p className="text-xs text-muted-foreground">{SITE.tagline}</p>
            {/* TODO: Mustafa to finalize blurb */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {SITE.blurb}
            </p>
          </div>

          {/* Col 2: Services */}
          <FooterColumn title="Services" links={footerServices} />

          {/* Col 3: Company */}
          <FooterColumn title="Company" links={footerCompany} />

          {/* Col 4: Legal + Client Login */}
          <div>
            <FooterColumn title="Legal" links={footerLegal} />
            <div className="mt-4">
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Client Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            &copy; {SITE.copyrightYear} {SITE.legalEntity}. All rights reserved.
            <br />
            {SITE.brandName} ({SITE.brandAbbr}) is a service of {SITE.legalAbbr}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Registered office: {SITE.registeredOffice}
          </p>
        </div>
      </div>
    </footer>
  )
}
