export const SPLIT_CTA = {
  hiring: {
    eyebrow: 'For employers',
    title: "Hiring? Let's find them.",
    body: "Tell us about the role and we'll come back with a shortlist within days, not weeks.",
    ctaLabel: 'Request Talent',
    ctaHref: '/contact?type=hiring',
  },
  candidates: {
    eyebrow: 'For candidates',
    title: 'Looking for your next role?',
    body: "Browse open roles or send us your CV — we'll keep you in mind for the right opportunity.",
    ctaLabel: 'Browse Open Roles',
    ctaHref: '/jobs',
    ctaSecondaryLabel: 'Submit your CV',
    ctaSecondaryHref: '/candidates',
  },
} as const
