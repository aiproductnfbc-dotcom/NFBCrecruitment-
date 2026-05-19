import { Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <Construction size={56} className="text-gray-300 mb-4" />
      <h2 className="text-2xl font-bold text-gray-600">{title}</h2>
      <p className="text-gray-400 mt-2">Coming soon — this page will be built in Batch 10.</p>
    </div>
  )
}
