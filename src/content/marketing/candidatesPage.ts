export const CANDIDATES_PAGE = {
  hero: {
    eyebrow: 'For Candidates',
    title: 'Your next role, in good hands.',
    subhead:
      'We work with serious employers across multiple sectors. Send us your CV, browse open roles, or both.',
    primaryCta: { label: 'Browse Open Roles', href: '/jobs' },
    secondaryCta: { label: 'Submit your CV', href: '/contact?type=candidate' },
  },
  promise: {
    eyebrow: 'Our promise to you',
    items: [
      {
        icon: 'MessageSquare',
        title: 'Real conversations',
        body: "We'll talk to you about what you actually want — not just match keywords.",
      },
      {
        icon: 'Lock',
        title: 'Confidential by default',
        body: 'We never share your CV with a client without your explicit go-ahead.',
      },
      {
        icon: 'Compass',
        title: 'Honest direction',
        body: "If a role isn't right for you, we'll tell you. If we can't help right now, we'll tell you that too.",
      },
      {
        icon: 'Calendar',
        title: 'Kept in the loop',
        body: "You'll always know where your application stands — no ghosting.",
      },
    ],
  },
  process: {
    eyebrow: 'How it works',
    title: 'From CV to offer.',
    steps: [
      { number: '01', title: 'Send us your CV', body: 'Use the form, or apply to a specific open role.' },
      { number: '02', title: 'Quick conversation', body: 'A 20-minute call to understand your goals, motivators, and fit.' },
      { number: '03', title: 'We match and submit', body: 'When the right role lands, we present you to the client with context.' },
      { number: '04', title: 'Interview support', body: 'We brief you, prep you, and gather feedback after each round.' },
      { number: '05', title: 'Offer & onboarding', body: 'We help negotiate, accept, and settle into the first 90 days.' },
    ],
  },
  faq: [
    {
      q: 'Do I need to register an account?',
      a: 'No. You can apply to any open role on the jobs page without creating an account, or send us your CV via the candidate form.',
    },
    {
      q: 'What sectors do you cover?',
      a: 'We currently recruit across technology, banking, energy, healthcare, construction, manufacturing, retail, telecoms, government, and hospitality. See the Industries page for the full list.',
    },
    {
      q: 'How long does the process take?',
      a: 'It depends on the role — typically 2–6 weeks from first conversation to offer for permanent positions.',
    },
    {
      q: 'Will my current employer find out I\'m looking?',
      a: 'Not from us. Your CV is never shared without your permission, and we treat every conversation as confidential.',
    },
  ],
} as const
