import { useState, useEffect, useCallback } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import BrandMark from './BrandMark'
import { headerNav } from '../../content/marketing/nav'

export default function MarketingHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setDrawerOpen(false)
  }, [])

  useEffect(() => {
    if (drawerOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [drawerOpen, handleKeyDown])

  return (
    <>
      <header className="sticky top-0 z-40 h-16 flex items-center border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto w-full max-w-6xl px-6 flex items-center justify-between">
          {/* Left: brand */}
          <BrandMark />

          {/* Center: desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {headerNav.map(link => (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: CTA buttons (desktop) */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Login
            </Link>
            <Link
              to="/jobs"
              className="px-4 py-2 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Browse Jobs
            </Link>
            <Link
              to="/contact?type=hiring"
              className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Request Talent
            </Link>
          </div>

          {/* Mobile: hamburger */}
          <button
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <nav
            className="absolute top-0 right-0 h-full w-72 max-w-[80vw] bg-background border-l border-border shadow-xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="font-semibold text-sm text-foreground">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 px-3">
              {headerNav.map(link => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  className={({ isActive }) =>
                    `block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-foreground bg-accent'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}

              <div className="my-3 border-t border-border" />

              <Link
                to="/jobs"
                className="block px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Browse Jobs
              </Link>
              <Link
                to="/contact?type=hiring"
                className="block px-3 py-2.5 rounded-md text-sm font-medium text-primary hover:bg-accent transition-colors"
              >
                Request Talent
              </Link>

              <div className="my-3 border-t border-border" />

              <Link
                to="/login"
                className="block px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Client Login
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
