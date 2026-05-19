// ── Hero ──────────────────────────────────────────────────────────────────────

// Candidate headlines:
// 1. "The right people, placed with precision"
// 2. "Specialist recruitment that moves your business forward"
// 3. "Find the talent that changes everything"

export const HERO = {
  eyebrow: 'New Frontiers Talent',
  headline: 'Specialist recruitment that moves your business forward',
  headlineAccent: 'moves your business forward',
  subheadline:
    'End-to-end recruitment services across the Middle East and beyond \u2014 ' +
    'permanent, contract, and executive search, backed by deep sector expertise ' +
    'and our own modern recruitment technology.',
  primaryCta: { label: 'Request Talent', href: '/contact?type=hiring' },
  secondaryCta: { label: 'Browse Open Roles', href: '/jobs' },
} as const

// ── Trust bar ─────────────────────────────────────────────────────────────────

export const TRUST_BAR = {
  label: 'Trusted by teams across the region',
  logos: [
    { name: 'Acme Corp' },
    { name: 'Globex' },
    { name: 'Initech' },
    { name: 'Umbrella' },
    { name: 'Soylent' },
    { name: 'Stark Industries' },
  ],
} as const
