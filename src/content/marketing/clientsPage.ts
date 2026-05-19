export const CLIENTS_PAGE = {
  hero: {
    eyebrow: 'For Clients',
    title: "Recruitment, with the technology you'd expect.",
    subhead:
      "We don't just place candidates — we partner with you, and we open up the same recruitment platform our team uses.",
    primaryCta: { label: 'Request Talent', href: '/contact?type=hiring' },
    secondaryCta: { label: 'Talk to us', href: '/contact?type=hiring' },
  },
  partnership: {
    eyebrow: 'Why partner with NFT',
    title: 'Recruitment as a strategic function, not a transaction.',
    pillars: [
      {
        icon: 'Target',
        title: 'Specialist focus',
        body: 'Sector-specialist recruiters who actually understand the roles they hire for.',
      },
      {
        icon: 'Workflow',
        title: 'Embedded process',
        body: 'We integrate with your hiring workflow — interview panels, briefings, debriefs.',
      },
      {
        icon: 'Handshake',
        title: 'Long-term partnership',
        body: 'We measure success in retained hires, not closed roles.',
      },
    ],
  },
  portal: {
    eyebrow: 'The Client Portal',
    title: 'See your pipeline. Live.',
    leadIn:
      'Every NFT client gets access to a secure portal where you can see open roles, shortlisted candidates, interview feedback, and placement status in real time. No more email chains. No more stale spreadsheets.',
    capabilities: [
      {
        icon: 'Eye',
        title: 'Shortlist visibility',
        body: 'Review every candidate we\'ve shortlisted with structured notes and CVs in one place.',
      },
      {
        icon: 'MessageSquare',
        title: 'Interview feedback capture',
        body: 'Submit structured feedback after each interview — ratings, notes, decisions — without an email chain.',
      },
      {
        icon: 'Activity',
        title: 'Real-time status',
        body: 'Watch candidates move through the pipeline live: shortlisted, interviewing, offered, placed.',
      },
      {
        icon: 'FileText',
        title: 'Job request submission',
        body: 'Open new requisitions directly through the portal — no PDFs, no back-and-forth on requirements.',
      },
    ],
    trust: [
      { icon: 'Lock', title: 'Role-based access', body: 'Each user only sees roles assigned to them.' },
      { icon: 'ShieldCheck', title: 'Row-level security', body: 'Data isolation per client at the database layer.' },
      { icon: 'FileCheck', title: 'Full audit trail', body: 'Every action logged for compliance.' },
    ],
  },
  faq: [
    {
      q: 'Do we need to use the Client Portal to work with NFT?',
      a: "No. The portal is offered to every client, but if you'd rather work over email or scheduled calls, we'll match how you want to work.",
    },
    {
      q: 'How do you charge?',
      a: 'Most placements are on a contingent or retained basis depending on role seniority. We agree fees per engagement — no hidden costs and no portal subscription.',
    },
    {
      q: 'Where is candidate and client data stored?',
      a: 'On infrastructure operated by NFBC with role-based access, row-level security at the database layer, and full audit logging. We follow GDPR-aligned practices.',
    },
    {
      q: 'Can the portal be branded for our company?',
      a: "We're rolling out per-client branding in a future release. Talk to us about your requirements.",
    },
  ],
} as const
