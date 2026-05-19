export type ServiceIconName =
  | 'Users'
  | 'Clock'
  | 'Crown'
  | 'Workflow'
  | 'Map'
  | 'Handshake'

export interface ServiceItem {
  slug: string
  title: string
  icon: ServiceIconName
  blurb: string
  tagline: string
  heroBlurb: string
  whoItsFor: string[]
  whatYouGet: string[]
  idealWhen: string
}

export const SERVICES: readonly ServiceItem[] = [
  {
    slug: 'permanent-placement',
    title: 'Permanent Placement',
    icon: 'Users',
    blurb: 'End-to-end search and placement for full-time hires across all levels.',
    tagline: 'The right person, placed to stay.',
    heroBlurb:
      'We manage the full recruitment lifecycle for permanent roles — from briefing and sourcing through to offer negotiation and onboarding support. Every search is led by a sector-specialist recruiter who understands your market.',
    whoItsFor: [
      'Companies hiring for individual permanent roles at any level',
      'Teams scaling headcount across multiple functions',
      'Organisations replacing a critical leaver on a tight timeline',
    ],
    whatYouGet: [
      'Dedicated recruiter with sector expertise',
      'Structured candidate shortlist with assessment notes',
      'Interview coordination and candidate management',
      'Offer negotiation support',
      'Post-placement check-ins at 30, 60, and 90 days',
    ],
    idealWhen: 'You need a permanent hire and want a recruitment partner who owns the process end to end.',
  },
  {
    slug: 'contract-staffing',
    title: 'Contract & Temporary Staffing',
    icon: 'Clock',
    blurb: 'Flexible talent for project-based, seasonal, and interim needs.',
    tagline: 'Flexible talent, fast.',
    heroBlurb:
      'Whether you need project contractors, interim cover, or seasonal staff, we source and place candidates on fixed-term or rolling contracts. We handle compliance and keep the pipeline warm so you can scale up or down without delay.',
    whoItsFor: [
      'Project-driven teams needing specialist contractors',
      'Companies covering parental leave, sick leave, or resignations',
      'Organisations with seasonal or cyclical staffing needs',
    ],
    whatYouGet: [
      'Rapid shortlisting — typically within 48 hours',
      'Pre-vetted candidates with verified references',
      'Contract and compliance management support',
      'Ongoing contractor performance check-ins',
    ],
    idealWhen: 'You need capable people quickly, without the commitment of a permanent hire.',
  },
  {
    slug: 'executive-search',
    title: 'Executive Search',
    icon: 'Crown',
    blurb: 'Discreet, research-driven search for leadership and board-level roles.',
    tagline: 'Leadership hires, handled with discretion.',
    heroBlurb:
      'Senior and board-level appointments require a different approach — deeper research, tighter confidentiality, and a longer evaluation horizon. Our executive search practice is built around these requirements.',
    whoItsFor: [
      'Boards appointing C-suite or senior leadership',
      'Companies undergoing succession planning',
      'Organisations entering new markets and needing experienced regional leaders',
    ],
    whatYouGet: [
      'Confidential, research-led candidate identification',
      'Detailed candidate dossiers with background verification',
      'Structured interview and assessment process design',
      'Compensation benchmarking and offer advisory',
      'Extended post-placement support',
    ],
    idealWhen: 'You are filling a leadership role where discretion, thoroughness, and candidate quality matter more than speed.',
  },
  {
    slug: 'rpo',
    title: 'Recruitment Process Outsourcing',
    icon: 'Workflow',
    blurb: 'We embed with your team and run all or part of your hiring engine.',
    tagline: 'Your hiring function, run by us.',
    heroBlurb:
      "RPO is for organisations that want to hand off all or part of their recruitment operation to a specialist partner. We embed with your team, use your employer brand, and run the process using our technology and methodology.",
    whoItsFor: [
      'Companies without an in-house recruitment function',
      'Fast-growing teams that need to scale hiring without scaling HR headcount',
      'Organisations looking to reduce cost-per-hire and time-to-fill across the board',
    ],
    whatYouGet: [
      'Dedicated embedded recruiter(s) operating under your brand',
      'End-to-end process ownership: sourcing, screening, scheduling, offers',
      'Access to our recruitment platform for pipeline visibility',
      'Monthly reporting on hiring metrics and pipeline health',
      'Scalable model — add or reduce recruiter capacity as demand shifts',
    ],
    idealWhen: "You want a recruitment function without building one in-house, or you need to augment your existing team during a growth phase.",
  },
  {
    slug: 'talent-mapping',
    title: 'Talent Mapping & Market Intelligence',
    icon: 'Map',
    blurb: 'Competitor benchmarking, salary insights, and pipelines built ahead of demand.',
    tagline: 'Know the market before you hire.',
    heroBlurb:
      "Talent mapping gives you a clear picture of the available talent landscape before you commit to a search. We research your competitors' teams, benchmark compensation, and build a pipeline of candidates you can activate when the time is right.",
    whoItsFor: [
      'Companies planning headcount growth 3–12 months out',
      'HR leaders building a business case for new roles',
      'Organisations entering a new market or geography',
    ],
    whatYouGet: [
      'Competitor org-chart analysis and talent pool sizing',
      'Salary and benefits benchmarking by role and geography',
      'Pre-qualified candidate pipeline ready for activation',
      'Written market intelligence report',
    ],
    idealWhen: "You're not hiring today but want to understand the talent landscape so you can move quickly when the time comes.",
  },
  {
    slug: 'onboarding',
    title: 'Onboarding & Post-Placement Support',
    icon: 'Handshake',
    blurb: 'Structured 30/60/90-day check-ins to protect every placement we make.',
    tagline: 'A placement is only done when it sticks.',
    heroBlurb:
      "We don't walk away after the offer is signed. Every placement includes structured check-ins at 30, 60, and 90 days to catch issues early, support the new hire's transition, and protect your investment.",
    whoItsFor: [
      'Companies that have experienced early attrition from new hires',
      'Hiring managers who want structured feedback on how a placement is landing',
      'HR teams that want a consistent onboarding quality bar across departments',
    ],
    whatYouGet: [
      'Structured 30/60/90-day check-ins with both the hire and the hiring manager',
      'Early warning flags if the placement is at risk',
      'Onboarding best-practice guidance tailored to the role',
      'Replacement guarantee activation if needed',
    ],
    idealWhen: "You want assurance that every placement is supported through the critical first 90 days.",
  },
] as const
