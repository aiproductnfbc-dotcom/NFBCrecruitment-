import { Outlet } from 'react-router-dom'
import MarketingHeader from '../components/marketing/MarketingHeader'
import MarketingFooter from '../components/marketing/MarketingFooter'

export default function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main role="main" className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  )
}
