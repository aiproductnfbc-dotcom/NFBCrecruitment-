import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Upload, Users, Briefcase,
  Search, Settings, ChevronLeft, ChevronRight, LogOut, Building2,
  HandshakeIcon, BarChart3, ShieldCheck, Bell,
  AlertCircle, Calendar, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getNotificationItems,
  type NotificationItem, type NotificationType,
} from '../lib/notificationService'

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  admin:           { label: 'Admin',     className: 'bg-red-100 text-red-600' },
  account_manager: { label: 'Manager',   className: 'bg-purple-100 text-purple-600' },
  recruiter:       { label: 'Recruiter', className: 'bg-blue-100 text-blue-600' },
  viewer:          { label: 'Viewer',    className: 'bg-muted text-muted-foreground' },
}

const ROLE_PRIORITY = ['admin', 'account_manager', 'recruiter', 'viewer']

interface NavItem {
  path:      string
  label:     string
  icon:      React.ElementType
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { path: '/app/dashboard', label: 'Home',            icon: LayoutDashboard },
  { path: '/app/upload',    label: 'Upload',          icon: Upload },
  { path: '/app/contacts',  label: 'Contacts',        icon: Users },
  { path: '/app/clients',   label: 'Clients',         icon: Building2 },
  { path: '/app/jobs',      label: 'Jobs',            icon: Briefcase },
  { path: '/app/offers',    label: 'Offers & Placed', icon: HandshakeIcon },
  { path: '/app/reports',   label: 'Reports',         icon: BarChart3 },
  { path: '/app/search',    label: 'Search',          icon: Search },
  { path: '/app/settings',  label: 'Settings',        icon: Settings },
  { path: '/app/admin',     label: 'Admin',           icon: ShieldCheck, adminOnly: true },
]

// ─── Notification Bell ────────────────────────────────────────────────────────

const NOTIF_ICON: Record<NotificationType, React.ElementType> = {
  overdue_task:       AlertCircle,
  upcoming_interview: Calendar,
  feedback_needed:    MessageSquare,
}

const NOTIF_COLOR: Record<NotificationType, string> = {
  overdue_task:       'text-red-500 bg-red-50',
  upcoming_interview: 'text-blue-500 bg-blue-50',
  feedback_needed:    'text-orange-500 bg-orange-50',
}

function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items,  setItems]  = useState<NotificationItem[]>([])
  const [open,   setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.id) return
    getNotificationItems(user.id).then(setItems).catch(() => {})
  }, [user?.id])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleClick = (item: NotificationItem) => {
    setOpen(false)
    navigate(item.link)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {items.length > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
            <span className="text-xs text-gray-400">
              {items.length === 0 ? 'All clear' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell size={24} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">All caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {items.map(item => {
                const Icon = NOTIF_ICON[item.type]
                return (
                  <button
                    key={item.id}
                    onClick={() => handleClick(item)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${NOTIF_COLOR[item.type]}`}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 leading-snug truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{item.subtitle}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { profile, roles, isAdmin, signOut } = useAuth()

  const primaryRole = ROLE_PRIORITY.find(r => roles.includes(r))
  const badge = primaryRole ? ROLE_BADGE[primaryRole] : null

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 shrink-0 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-sidebar-border ${collapsed ? 'justify-center' : ''}`}>
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-bold shrink-0">
            NF
          </span>
          {!collapsed && (
            <span className="font-semibold text-sm truncate text-sidebar-foreground">NFT</span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {visibleItems.map(({ path, label, icon: Icon, adminOnly }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/app/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors text-sm ${
                  isActive
                    ? adminOnly
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : adminOnly
                      ? 'text-destructive hover:bg-sidebar-accent hover:text-destructive'
                      : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User info + role badge + logout */}
        {profile && (
          <div className={`border-t border-sidebar-border px-3 py-3 ${collapsed ? 'flex justify-center' : ''}`}>
            {!collapsed && (
              <div className="mb-2 px-1">
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {profile.full_name || profile.email}
                </p>
                {badge && (
                  <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={signOut}
              title="Sign out"
              className={`flex items-center gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg px-2 py-1.5 text-xs transition-colors w-full ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut size={15} className="shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`flex items-center gap-2 px-4 py-3 border-t border-sidebar-border text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-sm ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Collapse</span></>}
        </button>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">New Frontiers Talent</h1>
          <NotificationBell />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
