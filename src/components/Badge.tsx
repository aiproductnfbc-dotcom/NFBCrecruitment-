const SENIORITY_CLASSES: Record<string, string> = {
  'Intern':   'bg-gray-100 text-gray-600',
  'Junior':   'bg-blue-100 text-blue-700',
  'Mid':      'bg-green-100 text-green-700',
  'Senior':   'bg-orange-100 text-orange-700',
  'Lead':     'bg-purple-100 text-purple-700',
  'Manager':  'bg-indigo-100 text-indigo-700',
  'Director': 'bg-red-100 text-red-700',
  'VP':       'bg-pink-100 text-pink-700',
  'C-Suite':  'bg-amber-100 text-amber-700',
}

const DEPT_CLASSES: Record<string, string> = {
  'Engineering':  'bg-blue-100 text-blue-700',
  'Data':         'bg-cyan-100 text-cyan-700',
  'Product':      'bg-purple-100 text-purple-700',
  'Design':       'bg-pink-100 text-pink-700',
  'Marketing':    'bg-green-100 text-green-700',
  'Sales':        'bg-orange-100 text-orange-700',
  'Finance':      'bg-emerald-100 text-emerald-700',
  'HR':           'bg-yellow-100 text-yellow-700',
  'Operations':   'bg-gray-100 text-gray-700',
  'Legal':        'bg-red-100 text-red-700',
  'Consulting':   'bg-indigo-100 text-indigo-700',
  'Healthcare':   'bg-teal-100 text-teal-700',
  'Education':    'bg-violet-100 text-violet-700',
  'Other':        'bg-slate-100 text-slate-600',
}

const STATUS_CLASSES: Record<string, string> = {
  'open':       'bg-green-100 text-green-700',
  'closed':     'bg-gray-100 text-gray-600',
  'on_hold':    'bg-yellow-100 text-yellow-700',
  'new':        'bg-blue-100 text-blue-700',
  'contacted':  'bg-yellow-100 text-yellow-700',
  'interested': 'bg-green-100 text-green-700',
  'rejected':   'bg-red-100 text-red-700',
  'placed':     'bg-purple-100 text-purple-700',
}

type BadgeVariant = 'seniority' | 'department' | 'status'

interface BadgeProps {
  value: string | null | undefined
  variant: BadgeVariant
  className?: string
}

function getClasses(value: string, variant: BadgeVariant): string {
  switch (variant) {
    case 'seniority':  return SENIORITY_CLASSES[value] ?? 'bg-gray-100 text-gray-600'
    case 'department': return DEPT_CLASSES[value]      ?? 'bg-slate-100 text-slate-600'
    case 'status':     return STATUS_CLASSES[value]    ?? 'bg-gray-100 text-gray-600'
  }
}

export default function Badge({ value, variant, className = '' }: BadgeProps) {
  if (!value) return <span className="text-gray-400">—</span>
  const colorClasses = getClasses(value, variant)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses} ${className}`}>
      {value}
    </span>
  )
}
