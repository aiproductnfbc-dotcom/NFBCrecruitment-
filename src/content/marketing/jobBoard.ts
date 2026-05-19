export const JOB_BOARD = {
  filters: {
    employmentType: [
      { value: '', label: 'All types' },
      { value: 'permanent', label: 'Permanent' },
      { value: 'contract', label: 'Contract' },
      { value: 'temporary', label: 'Temporary' },
      { value: 'internship', label: 'Internship' },
      { value: 'executive', label: 'Executive' },
    ],
    remotePolicy: [
      { value: '', label: 'All work modes' },
      { value: 'onsite', label: 'On-site' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'remote', label: 'Remote' },
    ],
    seniority: [
      { value: '', label: 'Any level' },
      { value: 'Junior', label: 'Junior' },
      { value: 'Mid-level', label: 'Mid-level' },
      { value: 'Senior', label: 'Senior' },
      { value: 'Lead', label: 'Lead' },
      { value: 'Director', label: 'Director' },
      { value: 'Executive', label: 'Executive' },
    ],
    sort: [
      { value: 'newest', label: 'Newest first' },
      { value: 'closing_soon', label: 'Closing soon' },
    ],
  },
  emptyState: {
    heading: 'No roles match your filters.',
    body: "Try broadening your search, or submit your CV and we'll reach out when something fits.",
    ctaLabel: 'Submit your CV',
    ctaHref: '/contact',
  },
} as const
