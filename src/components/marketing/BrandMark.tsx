import { Link } from 'react-router-dom'

interface BrandMarkProps {
  collapsed?: boolean
}

export default function BrandMark({ collapsed }: BrandMarkProps) {
  return (
    <Link to="/" className="flex items-center gap-2.5 group" aria-label="New Frontiers Talent home">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-primary text-primary-foreground text-xs font-bold shrink-0">
        NF
      </span>
      <span className={`font-semibold text-sm text-foreground tracking-tight ${collapsed ? 'hidden' : 'hidden md:inline'}`}>
        New Frontiers Talent
      </span>
      <span className={`font-semibold text-sm text-foreground tracking-tight ${collapsed ? 'inline' : 'md:hidden'}`}>
        NFT
      </span>
    </Link>
  )
}
