export type IndustryIconName =
  | 'Cpu'
  | 'Landmark'
  | 'Flame'
  | 'Stethoscope'
  | 'HardHat'
  | 'Factory'
  | 'ShoppingBag'
  | 'Radio'
  | 'Building2'
  | 'Hotel'

export interface IndustryItem {
  slug: string
  name: string
  icon: IndustryIconName
  summary: string
  sampleRoles: string[]
  // TODO: keyClients to be added once approved by NFT
}

export const INDUSTRIES: readonly IndustryItem[] = [
  {
    slug: 'technology',
    name: 'Technology & Software',
    icon: 'Cpu',
    summary:
      'We recruit across the full technology stack — from software engineers and data scientists to CTOs and product leaders. Our network spans startups, scale-ups, and enterprise technology teams across the region.',
    sampleRoles: ['Software Engineer', 'Data Scientist', 'DevOps Engineer', 'Product Manager', 'CTO'],
  },
  {
    slug: 'banking',
    name: 'Banking & Financial Services',
    icon: 'Landmark',
    summary:
      'From retail banking to investment management, we place professionals across front, middle, and back-office functions. We understand the regulatory environment and the compliance expectations that come with financial services hiring.',
    sampleRoles: ['Risk Analyst', 'Relationship Manager', 'Compliance Officer', 'Finance Controller', 'Investment Analyst'],
  },
  {
    slug: 'energy',
    name: 'Energy & Oil & Gas',
    icon: 'Flame',
    summary:
      'We have deep roots in the energy sector, placing technical and leadership talent across upstream, midstream, and downstream operations. Our candidates come with the certifications and field experience the sector demands.',
    sampleRoles: ['Drilling Engineer', 'HSE Manager', 'Petroleum Engineer', 'Process Engineer', 'Plant Manager'],
  },
  {
    slug: 'healthcare',
    name: 'Healthcare & Life Sciences',
    icon: 'Stethoscope',
    summary:
      'We recruit clinical, research, and administrative professionals for hospitals, clinics, pharmaceutical companies, and medical device firms. Compliance with local licensing requirements is built into our vetting process.',
    sampleRoles: ['Clinical Research Associate', 'Hospital Administrator', 'Pharmacist', 'Medical Director', 'Quality Assurance Manager'],
  },
  {
    slug: 'construction',
    name: 'Construction & Engineering',
    icon: 'HardHat',
    summary:
      'From mega-projects to specialist fit-out, we place engineers, project managers, and site leadership. Our candidates are experienced with regional building codes, safety standards, and the pace of large-scale delivery.',
    sampleRoles: ['Project Director', 'Structural Engineer', 'Quantity Surveyor', 'Site Manager', 'MEP Engineer'],
  },
  {
    slug: 'manufacturing',
    name: 'Manufacturing & Industrial',
    icon: 'Factory',
    summary:
      'We support manufacturers and industrial operations with technical, operational, and leadership talent. Our reach covers everything from production floor specialists to supply chain directors.',
    sampleRoles: ['Production Manager', 'Supply Chain Director', 'Quality Engineer', 'Maintenance Manager', 'Operations Director'],
  },
  {
    slug: 'retail',
    name: 'Retail & Consumer Goods',
    icon: 'ShoppingBag',
    summary:
      'We recruit across retail operations, merchandising, marketing, and e-commerce. Whether you need a regional store manager or a head of digital, we know the talent pool.',
    sampleRoles: ['Head of E-Commerce', 'Regional Manager', 'Merchandising Director', 'Brand Manager', 'Category Manager'],
  },
  {
    slug: 'telecom',
    name: 'Telecommunications',
    icon: 'Radio',
    summary:
      'We place technical and commercial talent across mobile, fixed-line, and broadband operators as well as infrastructure vendors. Our network includes RF engineers, network architects, and commercial leaders.',
    sampleRoles: ['RF Engineer', 'Network Architect', 'Head of Commercial', 'Solutions Architect', 'Product Owner'],
  },
  {
    slug: 'government',
    name: 'Government & Public Sector',
    icon: 'Building2',
    summary:
      'We work with government entities and public-sector organisations to fill specialist and leadership roles. We understand the procurement processes and clearance requirements that come with public-sector hiring.',
    sampleRoles: ['Policy Advisor', 'Programme Director', 'IT Director', 'Procurement Manager', 'Public Affairs Specialist'],
  },
  {
    slug: 'hospitality',
    name: 'Hospitality & Tourism',
    icon: 'Hotel',
    summary:
      'From hotel general managers to F&B directors, we recruit leadership and specialist talent for the hospitality and tourism sector. Our candidates understand the service standards and operational intensity the industry demands.',
    sampleRoles: ['General Manager', 'F&B Director', 'Revenue Manager', 'Executive Chef', 'Guest Experience Manager'],
  },
] as const
