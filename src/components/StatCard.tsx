import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | null
  icon: LucideIcon
  iconBg: string
  iconColor: string
  loading?: boolean
}

export default function StatCard({ title, value, icon: Icon, iconBg, iconColor, loading }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${iconBg}`}>
        <Icon size={24} className={iconColor} />
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded mb-1" />
        ) : (
          <p className="text-3xl font-bold text-gray-900">{(value ?? 0).toLocaleString()}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">{title}</p>
      </div>
    </div>
  )
}
