import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
}

export default function EmptyState({
  title = 'No data yet',
  description = 'Nothing to show here.',
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={48} className="text-gray-300 mb-4" />
      <p className="text-lg font-medium text-gray-500">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
    </div>
  )
}
