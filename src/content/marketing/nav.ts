export interface NavLink {
  label: string
  href: string
}

export const headerNav: NavLink[] = [
  { label: 'Services', href: '/services' },
  { label: 'Industries', href: '/industries' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'For Clients', href: '/clients' },
  { label: 'About', href: '/about' },
]

export const footerServices: NavLink[] = [
  { label: 'All Services', href: '/services' },
  { label: 'Permanent Recruitment', href: '/services#permanent' },
  { label: 'Contract Staffing', href: '/services#contract' },
  { label: 'Executive Search', href: '/services#executive' },
  { label: 'RPO', href: '/services#rpo' },
]

export const footerCompany: NavLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Industries', href: '/industries' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'For Clients', href: '/clients' },
  { label: 'Contact', href: '/contact' },
]

export const footerLegal: NavLink[] = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
]
