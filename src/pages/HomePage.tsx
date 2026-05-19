import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserPlus, Briefcase, ClipboardList, CheckSquare,
  AlertCircle, Check, Loader2, DollarSign, Calendar,
  Video, Phone, Monitor, Layers, Users2, Building2,
  TrendingUp, FileText, ChevronRight,
} from 'lucide-react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { SkeletonCard, Skeleton } from '../components/LoadingSkeleton'
import {
  getDashboardStats, getRecentJobs, getExtraStats,
  type DashboardStats, type ExtraStats,
} from '../lib/dashboardService'
import { getMyTasks, completeTask, type MyTask } from '../lib/activityService'
import { getUpcomingInterviews, type InterviewWithContext, type InterviewType } from '../lib/interviewService'
import { getRevenueStats, type RevenueStats } from '../lib/placementService'
import { useAuth } from '../context/AuthContext'
import type { Job } from '../lib/jobService'

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}
function fmtPct(num: number, denom: number) {
  if (!denom) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

// ── Colour palettes ───────────────────────────────────────────────────────────

const DEPT_COLORS = [
  '#3b82f6','#8b5cf6','#10b981','#f97316','#ec4899',
  '#06b6d4','#ef4444','#6366f1','#eab308','#14b8a6',
]

const SENIORITY_ORDER = ['Intern','Junior','Mid','Senior','Lead','Manager','Director','VP','C-Level','Executive','Unknown']
const SENIORITY_COLORS: Record<string, string> = {
  'Intern':    '#94a3b8', 'Junior':    '#60a5fa', 'Mid':       '#3b82f6',
  'Senior':    '#7c3aed', 'Lead':      '#6d28d9', 'Manager':   '#5b21b6',
  'Director':  '#4c1d95', 'VP':        '#7f1d1d', 'C-Level':   '#991b1b',
  'Executive': '#450a0a', 'Unknown':   '#9ca3af',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, accent, sub, onClick,
}: {
  title: string; value: string | number; icon: React.ElementType
  accent: string; sub?: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{title}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </button>
  )
}

// ── Recruitment Pipeline Funnel ───────────────────────────────────────────────

function PipelineFunnel({ extra, mainStats, loading }: {
  extra: ExtraStats | null; mainStats: DashboardStats | null; loading: boolean
}) {
  const steps = [
    { label: 'Contacts',     value: mainStats?.total_contacts ?? 0,       color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Applications', value: extra?.total_applications ?? 0,       color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Interviews',   value: extra?.total_interviews   ?? 0,       color: '#f97316', bg: '#fff7ed' },
    { label: 'Offers',       value: extra?.total_offers       ?? 0,       color: '#10b981', bg: '#ecfdf5' },
    { label: 'Placements',   value: extra?.total_placements   ?? 0,       color: '#059669', bg: '#d1fae5' },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          Recruitment Pipeline
        </h3>
        <span className="text-xs text-gray-400">End-to-end funnel</span>
      </div>

      {loading ? (
        <div className="flex gap-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="flex-1 h-20" />)}</div>
      ) : (
        <div className="flex items-stretch gap-0">
          {steps.map((step, i) => {
            const prev = i > 0 ? steps[i - 1].value : null
            const conv = prev ? fmtPct(step.value, prev) : null
            const pct  = steps[0].value > 0 ? Math.max(4, Math.round((step.value / steps[0].value) * 100)) : 4
            return (
              <div key={step.label} className="flex items-center flex-1 min-w-0">
                {i > 0 && (
                  <div className="flex flex-col items-center px-1 shrink-0">
                    <ChevronRight size={18} className="text-gray-300" />
                    {conv && <span className="text-[10px] text-gray-400 whitespace-nowrap">{conv}</span>}
                  </div>
                )}
                <div
                  className="flex-1 rounded-xl p-3 text-center min-w-0 border transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: step.bg,
                    borderColor: step.color + '33',
                    borderBottomWidth: 3,
                    borderBottomColor: step.color,
                  }}
                >
                  <div
                    className="mx-auto mb-1.5 rounded-full transition-all"
                    style={{ height: 4, backgroundColor: step.color, width: `${pct}%`, minWidth: 8 }}
                  />
                  <p className="text-xl font-bold" style={{ color: step.color }}>
                    {step.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{step.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Jobs by Status Donut ──────────────────────────────────────────────────────

function JobsStatusDonut({ extra, loading }: { extra: ExtraStats | null; loading: boolean }) {
  const segments = [
    { label: 'Open',    value: extra?.jobs_by_status.open    ?? 0, color: '#10b981' },
    { label: 'On Hold', value: extra?.jobs_by_status.on_hold ?? 0, color: '#f59e0b' },
    { label: 'Closed',  value: extra?.jobs_by_status.closed  ?? 0, color: '#6b7280' },
  ]
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  // Build conic-gradient
  let deg = 0
  const parts = segments
    .filter(s => s.value > 0)
    .map(s => {
      const start = deg
      deg += (s.value / (total || 1)) * 360
      return `${s.color} ${start.toFixed(1)}deg ${deg.toFixed(1)}deg`
    })
  const gradient = parts.length ? `conic-gradient(${parts.join(', ')})` : 'conic-gradient(#e5e7eb 0deg 360deg)'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
        <Briefcase size={16} className="text-orange-500" />
        Jobs by Status
      </h3>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="flex items-center gap-6">
          {/* Ring chart */}
          <div className="relative shrink-0 w-28 h-28">
            <div className="w-28 h-28 rounded-full" style={{ background: gradient }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center"
              >
                <span className="text-lg font-bold text-gray-800">{total}</span>
                <span className="text-[10px] text-gray-400">total</span>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="space-y-3 flex-1">
            {segments.map(seg => (
              <div key={seg.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-sm text-gray-600 flex-1">{seg.label}</span>
                <span className="text-sm font-semibold text-gray-800">{seg.value}</span>
                <span className="text-xs text-gray-400 w-10 text-right">{fmtPct(seg.value, total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Revenue Panel ─────────────────────────────────────────────────────────────

function RevenuePanel({ loading }: { loading?: boolean }) {
  const navigate = useNavigate()
  const [stats, setStats]     = useState<RevenueStats | null>(null)
  const [rev,   setRevLoading] = useState(true)

  useEffect(() => {
    const now  = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
    getRevenueStats({ from, to, groupBy: 'month' })
      .then(setStats).catch(() => {}).finally(() => setRevLoading(false))
  }, [])

  const rows = [
    { label: 'Paid',     value: stats?.totals.paid_revenue     ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Invoiced', value: stats?.totals.invoiced_revenue ?? 0, color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'Pending',  value: stats?.totals.pending_revenue  ?? 0, color: 'text-amber-600',   bg: 'bg-amber-50' },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <DollarSign size={16} className="text-emerald-500" />
          Revenue — This Month
        </h3>
        <button onClick={() => navigate('/app/offers')} className="text-xs text-primary hover:opacity-70">
          View all →
        </button>
      </div>
      {rev || loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <>
          <div className="space-y-2.5">
            {rows.map(r => (
              <div key={r.label} className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${r.bg}`}>
                <span className="text-sm text-gray-600">{r.label}</span>
                <span className={`text-lg font-bold ${r.color}`}>{fmtMoney(r.value)}</span>
              </div>
            ))}
          </div>
          {stats && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500">Placements this month</span>
              <span className="font-semibold text-gray-700">{stats.totals.placement_count}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Department Bars ───────────────────────────────────────────────────────────

function DepartmentBars({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  const depts = stats?.contacts_by_department ?? []
  const max   = Math.max(...depts.map(d => d.count), 1)
  const total = depts.reduce((s, d) => s + d.count, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Layers size={16} className="text-blue-500" />
        Contacts by Department
      </h3>
      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
      ) : !depts.length ? (
        <EmptyState title="No department data" description="Upload contacts to see breakdown" />
      ) : (
        <div className="space-y-2.5">
          {depts.map((d, i) => {
            const color = DEPT_COLORS[i % DEPT_COLORS.length]
            const pct   = total > 0 ? Math.round((d.count / total) * 100) : 0
            return (
              <div key={d.department}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium truncate max-w-[180px]">{d.department}</span>
                  <span className="text-gray-400 ml-2 shrink-0">{d.count.toLocaleString()} · {pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(d.count / max) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Seniority Bars ────────────────────────────────────────────────────────────

function SeniorityBars({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  const raw   = stats?.contacts_by_seniority ?? []
  const sorted = [...raw].sort((a, b) => {
    const ai = SENIORITY_ORDER.indexOf(a.seniority_level)
    const bi = SENIORITY_ORDER.indexOf(b.seniority_level)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  const max   = Math.max(...sorted.map(s => s.count), 1)
  const total = sorted.reduce((s, d) => s + d.count, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Users size={16} className="text-purple-500" />
        Contacts by Seniority
      </h3>
      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
      ) : !sorted.length ? (
        <EmptyState title="No seniority data" description="Upload contacts to see breakdown" />
      ) : (
        <div className="space-y-2.5">
          {sorted.map(s => {
            const color = SENIORITY_COLORS[s.seniority_level] ?? '#9ca3af'
            const pct   = total > 0 ? Math.round((s.count / total) * 100) : 0
            return (
              <div key={s.seniority_level}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{s.seniority_level}</span>
                  <span className="text-gray-400">{s.count.toLocaleString()} · {pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(s.count / max) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Upcoming Interviews ───────────────────────────────────────────────────────

const INTERVIEW_ICON_MAP: Record<InterviewType, React.ElementType> = {
  phone: Phone, video: Video, onsite: Monitor, technical: Layers, panel: Users2,
}

function UpcomingInterviewsWidget() {
  const navigate = useNavigate()
  const [interviews, setInterviews] = useState<InterviewWithContext[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    getUpcomingInterviews(7).then(setInterviews).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar size={16} className="text-blue-500" />
        Upcoming Interviews
        {!loading && interviews.length > 0 && (
          <span className="ml-auto text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
            {interviews.length}
          </span>
        )}
      </h3>
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : !interviews.length ? (
        <EmptyState title="No interviews this week" description="Scheduled interviews for the next 7 days appear here" />
      ) : (
        <div className="divide-y divide-gray-100">
          {interviews.map(iv => {
            const TypeIcon = INTERVIEW_ICON_MAP[iv.type]
            const contact  = (iv.application?.contact) as any
            const job      = (iv.application?.job) as any
            const d        = new Date(iv.scheduled_at)
            return (
              <div key={iv.id}
                onClick={() => job?.id && navigate(`/app/jobs/${job.id}`)}
                className="flex items-center gap-3 py-2.5 hover:bg-gray-50 cursor-pointer rounded -mx-2 px-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <TypeIcon size={14} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{job?.job_title ?? '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-gray-600">
                    {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Top Companies ─────────────────────────────────────────────────────────────

function TopCompanies({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  const companies = stats?.top_companies ?? []
  const max = Math.max(...companies.map(c => c.count), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Building2 size={16} className="text-gray-500" />
        Top Companies in Database
      </h3>
      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
      ) : !companies.length ? (
        <EmptyState title="No companies yet" description="Upload contacts to see top companies" />
      ) : (
        <div className="space-y-1.5 overflow-y-auto max-h-72">
          {companies.map((c, i) => (
            <div key={c.company} className="flex items-center gap-3 group">
              <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-700 font-medium truncate">{c.company}</span>
                  <span className="text-gray-500 ml-2 shrink-0">{c.count}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full">
                  <div
                    className="h-1.5 bg-primary/70 rounded-full transition-all"
                    style={{ width: `${(c.count / max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Recent Uploads ────────────────────────────────────────────────────────────

function RecentUploads({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  const uploads = stats?.recent_uploads ?? []

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <FileText size={16} className="text-gray-500" />
        Recent Uploads
      </h3>
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : !uploads.length ? (
        <EmptyState title="No uploads yet" description="Upload a CSV to get started" />
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-72">
          {uploads.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <FileText size={14} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{u.employee_name}</p>
                <p className="text-xs text-gray-400 truncate">{u.filename}</p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-xs">
                  <span className="text-emerald-600 font-semibold">+{u.new_contacts}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-amber-500">{u.duplicates} dup</span>
                </p>
                <p className="text-[10px] text-gray-400">{formatDate(u.uploaded_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── My Tasks (bottom) ─────────────────────────────────────────────────────────

const SUBJECT_PATHS: Record<string, string> = {
  client: '/app/clients', contact: '/app/contacts', job: '/app/jobs', application: '/app/jobs',
}

function MyTasksWidget() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tasks,      setTasks]      = useState<MyTask[]>([])
  const [loading,    setLoading]    = useState(true)
  const [completing, setCompleting] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    getMyTasks(user.id).then(setTasks).catch(() => {}).finally(() => setLoading(false))
  }, [user?.id])

  const handleComplete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompleting(prev => new Set([...prev, id]))
    try {
      await completeTask(id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } finally {
      setCompleting(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  function isOverdue(iso: string | null) { return !!iso && new Date(iso) < new Date() }
  function fmtDue(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <CheckSquare size={16} className="text-purple-500" />
        My Tasks
        {!loading && tasks.length > 0 && (
          <span className="ml-2 text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{tasks.length}</span>
        )}
      </h3>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : !tasks.length ? (
        <EmptyState title="No open tasks" description="Tasks assigned to you will appear here" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {tasks.map(task => {
            const overdue = isOverdue(task.due_at)
            const due     = fmtDue(task.due_at)
            return (
              <div
                key={task.id}
                onClick={() => navigate(SUBJECT_PATHS[task.subject_type] ?? '/app/dashboard')}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                  overdue ? 'border-red-200 bg-red-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <button
                  onClick={e => handleComplete(task.id, e)}
                  disabled={completing.has(task.id)}
                  title="Mark complete"
                  className="shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 flex items-center justify-center transition-colors"
                >
                  {completing.has(task.id)
                    ? <Loader2 size={10} className="animate-spin text-gray-400" />
                    : <Check size={10} className="text-transparent hover:text-green-500" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{task.title}</p>
                  <p className="text-xs text-gray-400">{task.subject_label}</p>
                </div>
                {due && (
                  <span className={`text-xs font-medium shrink-0 flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                    {overdue && <AlertCircle size={10} />}
                    {due}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Open Jobs Table ───────────────────────────────────────────────────────────

function OpenJobsTable({ jobs, loading }: { jobs: Job[]; loading: boolean }) {
  const navigate = useNavigate()
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <ClipboardList size={16} className="text-indigo-500" />
          Recent Jobs
        </h3>
        <button onClick={() => navigate('/app/jobs')} className="text-xs text-primary hover:opacity-70">View all →</button>
      </div>
      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      ) : !jobs.length ? (
        <EmptyState title="No jobs yet" description="Create a job in the Jobs page to start matching candidates" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Job Title</th>
                <th className="pb-2 font-medium">Department</th>
                <th className="pb-2 font-medium">Seniority</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(req => (
                <tr
                  key={req.id}
                  onClick={() => navigate(`/app/jobs?expand=${req.id}`)}
                  className="border-b border-gray-50 hover:bg-primary/5 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 font-medium text-gray-800">{req.job_title}</td>
                  <td className="py-2.5 text-gray-500">{req.department ?? '—'}</td>
                  <td className="py-2.5 text-gray-500">{req.seniority ?? '—'}</td>
                  <td className="py-2.5"><Badge value={req.status} variant="status" /></td>
                  <td className="py-2.5 text-right text-gray-400 text-xs">{formatDate(req.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const [stats,   setStats]   = useState<DashboardStats | null>(null)
  const [extra,   setExtra]   = useState<ExtraStats | null>(null)
  const [jobs,    setJobs]    = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getDashboardStats(), getExtraStats(), getRecentJobs(8)])
      .then(([s, e, j]) => { setStats(s); setExtra(e); setJobs(j) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>
  )

  const kpis = [
    {
      title: 'Total Contacts',
      value: stats?.total_contacts  ?? 0,
      icon: Users,
      accent: 'bg-blue-100 text-blue-600',
      onClick: () => navigate('/app/contacts'),
    },
    {
      title: 'Active Clients',
      value: extra?.active_clients ?? 0,
      icon: Building2,
      accent: 'bg-emerald-100 text-emerald-600',
      onClick: () => navigate('/app/clients'),
    },
    {
      title: 'Open Jobs',
      value: extra?.jobs_by_status.open ?? 0,
      icon: Briefcase,
      accent: 'bg-orange-100 text-orange-600',
      onClick: () => navigate('/app/jobs'),
    },
    {
      title: 'Applications',
      value: extra?.total_applications ?? 0,
      icon: ClipboardList,
      accent: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Placements',
      value: extra?.total_placements ?? 0,
      icon: UserPlus,
      accent: 'bg-teal-100 text-teal-600',
      onClick: () => navigate('/app/offers'),
    },
    {
      title: 'Team Members',
      value: stats?.total_employees ?? 0,
      icon: Users2,
      accent: 'bg-indigo-100 text-indigo-600',
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">Your recruitment operation at a glance</p>
      </div>

      {/* Row 1 — KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading
          ? [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
          : kpis.map(k => <KpiCard key={k.title} {...k} />)
        }
      </div>

      {/* Row 2 — Pipeline funnel */}
      <PipelineFunnel extra={extra} mainStats={stats} loading={loading} />

      {/* Row 3 — Revenue + Jobs status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RevenuePanel loading={loading} />
        <JobsStatusDonut extra={extra} loading={loading} />
      </div>

      {/* Row 4 — Department + Seniority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DepartmentBars stats={stats} loading={loading} />
        <SeniorityBars  stats={stats} loading={loading} />
      </div>

      {/* Row 5 — Top companies + Upcoming interviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopCompanies          stats={stats} loading={loading} />
        <UpcomingInterviewsWidget />
      </div>

      {/* Row 6 — Recent uploads + Jobs table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentUploads stats={stats} loading={loading} />
        <OpenJobsTable jobs={jobs}   loading={loading} />
      </div>

      {/* Row 7 — My Tasks (bottom) */}
      <MyTasksWidget />
    </div>
  )
}
