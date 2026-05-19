import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3, ChevronDown, ChevronUp, Loader2,
  Users, Briefcase, CalendarCheck, DollarSign, TrendingUp,
  Building2, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import { Skeleton } from '../components/LoadingSkeleton'
import { useToast } from '../components/Toast'
import {
  getOverviewKPIs, getRecruiterPerformance, getClientAnalytics,
  getPipelineFunnel, getSourceEffectiveness, getRevenueTrend,
  getPresetRange,
  type DateRange, type OverviewKPIs, type RecruiterRow,
  type ClientRow, type FunnelStage, type SourceRow, type RevenueStats,
} from '../lib/reportingService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—'
  return `${n}%`
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

type Preset = 'week' | 'month' | 'quarter' | 'year' | 'custom'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year',    label: 'This Year' },
  { key: 'custom',  label: 'Custom' },
]

interface DateRangePickerProps {
  value: DateRange
  onChange: (r: DateRange) => void
}

function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState(value.from.slice(0, 10))
  const [customTo,   setCustomTo]   = useState(value.to.slice(0, 10))

  const selectPreset = (p: Preset) => {
    setActivePreset(p)
    if (p !== 'custom') {
      onChange(getPresetRange(p))
    }
  }

  const applyCustom = () => {
    if (!customFrom || !customTo) return
    onChange({
      from: new Date(customFrom).toISOString(),
      to:   new Date(customTo + 'T23:59:59').toISOString(),
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-gray-600">Period:</span>
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activePreset === p.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {activePreset === 'custom' && (
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={applyCustom}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function Section({
  title, icon: Icon, defaultOpen = true, children,
}: {
  title: string
  icon?: React.ElementType
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-800">
          {Icon && <Icon size={16} className="text-blue-500" />}
          {title}
        </span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  )
}

// ─── 1. Overview KPIs ─────────────────────────────────────────────────────────

const KPI_CONFIG: Array<{
  key: keyof OverviewKPIs
  label: string
  format: (v: number) => string
  color: string
}> = [
  { key: 'open_jobs',            label: 'Open Jobs',            format: v => String(v),    color: 'text-blue-600' },
  { key: 'new_candidates',       label: 'New Candidates',       format: v => String(v),    color: 'text-green-600' },
  { key: 'total_submissions',    label: 'Submissions',          format: v => String(v),    color: 'text-purple-600' },
  { key: 'interviews_scheduled', label: 'Interviews',           format: v => String(v),    color: 'text-orange-600' },
  { key: 'offers_made',          label: 'Offers Made',          format: v => String(v),    color: 'text-pink-600' },
  { key: 'hires',                label: 'Hires',                format: v => String(v),    color: 'text-emerald-600' },
  { key: 'total_revenue',        label: 'Total Revenue',        format: fmtMoney,           color: 'text-amber-600' },
]

function OverviewSection({ range }: { range: DateRange }) {
  const { toast } = useToast()
  const [kpis, setKpis]     = useState<OverviewKPIs | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getOverviewKPIs(range)
      .then(r => setKpis(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [range.from, range.to])

  if (loading) {
    return <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  }
  if (!kpis) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {KPI_CONFIG.map(c => (
        <div key={c.key} className="bg-gray-50 rounded-lg p-3 text-center">
          <p className={`text-2xl font-bold ${c.color}`}>{c.format(kpis[c.key])}</p>
          <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── 2. Recruiter Leaderboard ─────────────────────────────────────────────────

type RecruiterSortKey = keyof Pick<RecruiterRow,
  'recruiter_name' | 'submissions' | 'interviews' | 'offers' | 'hires' | 'revenue' | 'avg_days_to_fill'>

function SortHeader({
  col, label, sortKey, sortDir, onSort,
}: {
  col: RecruiterSortKey
  label: string
  sortKey: RecruiterSortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: RecruiterSortKey) => void
}) {
  const active = sortKey === col
  return (
    <th
      className="px-3 py-2 font-medium text-left cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
          : <ArrowUpDown size={12} className="text-gray-300" />}
      </span>
    </th>
  )
}

function RecruiterSection({ range, onFilter }: { range: DateRange; onFilter: (id: string | null) => void }) {
  const { toast } = useToast()
  const [rows,    setRows]    = useState<RecruiterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<RecruiterSortKey>('revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getRecruiterPerformance(range)
      .then(r => setRows(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [range.from, range.to])

  const handleSort = (k: RecruiterSortKey) => {
    if (sortKey === k) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    const cmp = typeof av === 'string'
      ? (av as string).localeCompare(bv as string)
      : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleRowClick = (id: string) => {
    const next = selected === id ? null : id
    setSelected(next)
    onFilter(next)
  }

  if (loading) return <Skeleton className="h-40 w-full" />
  if (!rows.length) return <p className="text-sm text-gray-400 py-4 text-center">No submissions in this period.</p>

  const sharedProps = { sortKey, sortDir, onSort: handleSort }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
          <tr>
            <SortHeader col="recruiter_name"   label="Recruiter"      {...sharedProps} />
            <SortHeader col="submissions"       label="Submissions"    {...sharedProps} />
            <SortHeader col="interviews"        label="Interviews"     {...sharedProps} />
            <th className="px-3 py-2 font-medium text-left text-gray-500">IV/Sub</th>
            <SortHeader col="offers"            label="Offers"         {...sharedProps} />
            <SortHeader col="hires"             label="Hires"          {...sharedProps} />
            <SortHeader col="revenue"           label="Revenue"        {...sharedProps} />
            <SortHeader col="avg_days_to_fill"  label="Avg Fill Days"  {...sharedProps} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={r.recruiter_id}
              onClick={() => handleRowClick(r.recruiter_id)}
              className={`border-b border-gray-100 cursor-pointer transition-colors ${
                selected === r.recruiter_id
                  ? 'bg-blue-50 border-blue-200'
                  : 'hover:bg-gray-50'
              }`}
            >
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0">
                    {i + 1}
                  </span>
                  {r.recruiter_name}
                  {selected === r.recruiter_id && (
                    <span className="text-xs text-blue-600 font-medium">• filtered</span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2.5 font-medium">{r.submissions}</td>
              <td className="px-3 py-2.5">{r.interviews}</td>
              <td className="px-3 py-2.5 text-gray-500">{r.iv_per_submission}×</td>
              <td className="px-3 py-2.5">{r.offers}</td>
              <td className="px-3 py-2.5">
                <span className={r.hires > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                  {r.hires}
                </span>
              </td>
              <td className="px-3 py-2.5 font-medium text-amber-700">{fmtMoney(r.revenue)}</td>
              <td className="px-3 py-2.5 text-gray-500">
                {r.avg_days_to_fill != null ? `${r.avg_days_to_fill}d` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── 3. Pipeline Funnel ────────────────────────────────────────────────────────

function FunnelSection({ range, recruiterId }: { range: DateRange; recruiterId: string | null }) {
  const { toast } = useToast()
  const [stages,  setStages]  = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getPipelineFunnel(range, recruiterId ? { recruiterId } : undefined)
      .then(r => setStages(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [range.from, range.to, recruiterId])

  if (loading) return <Skeleton className="h-48 w-full" />

  const maxCount = Math.max(...stages.map(s => s.count), 1)
  const activeStages = stages.filter(s => s.stage_type !== 'rejected')

  return (
    <div className="space-y-2">
      {activeStages.map((stage, i) => {
        const barPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
        const prev   = i > 0 ? activeStages[i - 1] : null
        const convRate = stage.conversion_rate

        return (
          <div key={stage.stage_id}>
            {/* Conversion arrow between stages */}
            {i > 0 && prev && prev.count > 0 && (
              <div className="flex items-center gap-2 py-0.5 pl-28">
                <div className="w-px h-3 bg-gray-300 ml-3" />
                <span className="text-xs text-gray-400">
                  {convRate != null ? `${convRate}% conversion` : '—'}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Stage label */}
              <div className="w-36 shrink-0 text-right">
                <span className="text-xs font-medium text-gray-600 truncate block">{stage.stage_name}</span>
                {stage.avg_days_in_stage != null && (
                  <span className="text-xs text-gray-400">{stage.avg_days_in_stage}d avg</span>
                )}
              </div>

              {/* Bar */}
              <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 flex items-center px-2 ${
                    stage.stage_type === 'hired'    ? 'bg-green-400' :
                    stage.stage_type === 'offer'    ? 'bg-amber-400'  :
                    stage.stage_type === 'interview'? 'bg-blue-400'   :
                    stage.stage_type === 'submitted'? 'bg-purple-400' :
                    'bg-slate-400'
                  }`}
                  style={{ width: `${Math.max(barPct, stage.count > 0 ? 4 : 0)}%` }}
                >
                  {stage.count > 0 && barPct > 15 && (
                    <span className="text-white text-xs font-bold">{stage.count}</span>
                  )}
                </div>
                {(stage.count === 0 || barPct <= 15) && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                    {stage.count}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Rejected row separate */}
      {stages.filter(s => s.stage_type === 'rejected').map(stage => (
        <div key={stage.stage_id} className="pt-2 border-t border-dashed border-gray-200 flex items-center gap-3 mt-2">
          <div className="w-36 shrink-0 text-right">
            <span className="text-xs font-medium text-red-400 truncate block">{stage.stage_name}</span>
          </div>
          <div className="flex-1 bg-red-50 rounded-full h-7 relative overflow-hidden">
            <div
              className="h-full rounded-full bg-red-300 flex items-center px-2"
              style={{ width: `${Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 4 : 0)}%` }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-red-500 font-medium">
              {stage.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 4. Source Breakdown ──────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  inbound:    'Inbound',
  referral:   'Referral',
  linkedin:   'LinkedIn',
  job_board:  'Job Board',
  headhunted: 'Headhunted',
  other:      'Other',
  unknown:    'Unknown',
}

function SourceSection({ range }: { range: DateRange }) {
  const { toast }  = useToast()
  const [rows,    setRows]    = useState<SourceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getSourceEffectiveness(range)
      .then(r => setRows(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [range.from, range.to])

  if (loading) return <Skeleton className="h-32 w-full" />
  if (!rows.length) return <p className="text-sm text-gray-400 py-4 text-center">No source data in this period.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-gray-500">
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Candidates</th>
            <th className="px-3 py-2 font-medium">Applications</th>
            <th className="px-3 py-2 font-medium">Interviewed</th>
            <th className="px-3 py-2 font-medium">Hires</th>
            <th className="px-3 py-2 font-medium">Hire Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.source} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2.5 font-medium text-gray-700">
                {SOURCE_LABELS[r.source] ?? r.source}
              </td>
              <td className="px-3 py-2.5">{r.total_candidates}</td>
              <td className="px-3 py-2.5">{r.applications}</td>
              <td className="px-3 py-2.5">{r.with_interviews}</td>
              <td className="px-3 py-2.5">
                <span className={r.hires > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                  {r.hires}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[60px]">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(r.conversion_rate, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    r.conversion_rate > 20 ? 'text-green-700' :
                    r.conversion_rate > 10 ? 'text-blue-700' :
                    'text-gray-500'
                  }`}>
                    {fmtPct(r.conversion_rate)}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── 5. Revenue Trend ─────────────────────────────────────────────────────────

function RevenueTrendSection({ range }: { range: DateRange }) {
  const { toast } = useToast()
  const [stats,   setStats]   = useState<RevenueStats | null>(null)
  const [groupBy, setGroupBy] = useState<'month' | 'quarter'>('month')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getRevenueTrend(range, groupBy)
      .then(r => setStats(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [range.from, range.to, groupBy])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton className="h-40 w-full" />
  if (!stats || !stats.breakdown.length) {
    return <p className="text-sm text-gray-400 py-4 text-center">No placements in this period.</p>
  }

  const maxRevenue = Math.max(...stats.breakdown.map(b => b.revenue), 1)

  return (
    <div className="space-y-4">
      {/* Controls + summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>Total: <strong className="text-amber-700">{fmtMoney(stats.totals.total_revenue)}</strong></span>
          <span className="text-gray-300">|</span>
          <span>Paid: <strong className="text-green-700">{fmtMoney(stats.totals.paid_revenue)}</strong></span>
          <span className="text-gray-300">|</span>
          <span>Avg fee: <strong>{fmtMoney(stats.totals.avg_fee)}</strong></span>
        </div>
        <div className="flex gap-1.5">
          {(['month', 'quarter'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                groupBy === g ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g === 'month' ? 'Monthly' : 'Quarterly'}
            </button>
          ))}
        </div>
      </div>

      {/* CSS bar chart */}
      <div className="flex items-end gap-2 h-40 border-b border-gray-200 pb-1 overflow-x-auto">
        {stats.breakdown.map(b => {
          const pct = (b.revenue / maxRevenue) * 100
          return (
            <div key={b.group_key} className="flex flex-col items-center gap-1 shrink-0 min-w-[40px]">
              <span className="text-xs text-gray-500 font-medium">{fmtMoney(b.revenue)}</span>
              <div className="w-8 relative flex flex-col justify-end" style={{ height: '100px' }}>
                <div
                  className="w-full rounded-t-sm bg-primary hover:bg-primary/90 transition-colors cursor-default"
                  style={{ height: `${Math.max(pct, b.revenue > 0 ? 3 : 0)}%` }}
                  title={`${b.group_key}: ${fmtMoney(b.revenue)} (${b.count} placements)`}
                />
                {b.paid > 0 && b.paid < b.revenue && (
                  <div
                    className="absolute bottom-0 w-full rounded-t-sm bg-green-500"
                    style={{ height: `${(b.paid / maxRevenue) * 100}%` }}
                    title={`Paid: ${fmtMoney(b.paid)}`}
                  />
                )}
              </div>
              <span className="text-xs text-gray-400 truncate max-w-[56px] text-center">
                {b.group_key}
              </span>
              <span className="text-xs text-gray-300">{b.count}p</span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Total billed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Paid</span>
      </div>
    </div>
  )
}

// ─── 6. Client Rankings ───────────────────────────────────────────────────────

function ClientSection({ range }: { range: DateRange }) {
  const { toast }  = useToast()
  const [rows,    setRows]    = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getClientAnalytics(range)
      .then(r => setRows(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [range.from, range.to])

  if (loading) return <Skeleton className="h-32 w-full" />
  if (!rows.length) return <p className="text-sm text-gray-400 py-4 text-center">No client data in this period.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-gray-500">
            <th className="px-3 py-2 font-medium w-8">#</th>
            <th className="px-3 py-2 font-medium">Client</th>
            <th className="px-3 py-2 font-medium">Jobs Posted</th>
            <th className="px-3 py-2 font-medium">Jobs Filled</th>
            <th className="px-3 py-2 font-medium">Active Pipeline</th>
            <th className="px-3 py-2 font-medium">Revenue</th>
            <th className="px-3 py-2 font-medium">Avg Fill Days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.client_id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
              <td className="px-3 py-2.5 font-medium text-gray-800">{r.client_name}</td>
              <td className="px-3 py-2.5">{r.jobs_posted}</td>
              <td className="px-3 py-2.5">
                <span className={r.jobs_filled > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                  {r.jobs_filled}
                </span>
                {r.jobs_posted > 0 && (
                  <span className="text-xs text-gray-400 ml-1">
                    ({Math.round(r.jobs_filled / r.jobs_posted * 100)}%)
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-gray-600">{r.active_pipeline}</td>
              <td className="px-3 py-2.5 font-medium text-amber-700">{fmtMoney(r.total_revenue)}</td>
              <td className="px-3 py-2.5 text-gray-500">
                {r.avg_days_to_fill != null ? `${r.avg_days_to_fill}d` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(getPresetRange('month'))
  const [recruiterFilter, setRecruiterFilter] = useState<string | null>(null)

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
        <p className="text-gray-500 text-sm mt-1">
          All sections use the selected date range. Click a recruiter row to filter the funnel.
        </p>
      </div>

      {/* Date Range Picker — applies to all sections */}
      <DateRangePicker value={range} onChange={r => { setRange(r); setRecruiterFilter(null) }} />

      <Section title="Overview KPIs" icon={BarChart3}>
        <OverviewSection range={range} />
      </Section>

      <Section title="Recruiter Leaderboard" icon={Users}>
        <RecruiterSection range={range} onFilter={setRecruiterFilter} />
      </Section>

      <Section title="Pipeline Funnel" icon={TrendingUp}>
        {recruiterFilter && (
          <div className="mb-3 flex items-center gap-2 text-sm text-blue-600">
            <span>Filtered by selected recruiter</span>
            <button onClick={() => setRecruiterFilter(null)} className="underline text-xs text-gray-400 hover:text-gray-600">
              Clear
            </button>
          </div>
        )}
        <FunnelSection range={range} recruiterId={recruiterFilter} />
      </Section>

      <Section title="Source Breakdown" icon={Briefcase}>
        <SourceSection range={range} />
      </Section>

      <Section title="Revenue Trend" icon={DollarSign}>
        <RevenueTrendSection range={range} />
      </Section>

      <Section title="Client Rankings" icon={Building2}>
        <ClientSection range={range} />
      </Section>
    </div>
  )
}
