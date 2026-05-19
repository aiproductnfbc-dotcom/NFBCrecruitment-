import { supabase } from './supabaseClient'
import { getRevenueStats, type RevenueStats } from './placementService'

// ── Shared types ───────────────────────────────────────────────────────────────

export interface DateRange {
  from: string  // ISO timestamptz
  to:   string  // ISO timestamptz
}

interface Meta {
  date_from:    string
  date_to:      string
  generated_at: string
}

export interface AnalyticsResult<T> {
  data: T
  meta: Meta
}

function makeMeta(range: DateRange): Meta {
  return {
    date_from:    range.from,
    date_to:      range.to,
    generated_at: new Date().toISOString(),
  }
}

function wrap<T>(data: T, range: DateRange): AnalyticsResult<T> {
  return { data, meta: makeMeta(range) }
}

// ── Date range presets ─────────────────────────────────────────────────────────

export function getPresetRange(preset: 'week' | 'month' | 'quarter' | 'year'): DateRange {
  const now  = new Date()
  const year = now.getFullYear()
  const mon  = now.getMonth()

  switch (preset) {
    case 'week': {
      const day  = now.getDay() // 0=Sun
      const from = new Date(now)
      from.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      from.setHours(0, 0, 0, 0)
      const to = new Date(now)
      to.setHours(23, 59, 59, 999)
      return { from: from.toISOString(), to: to.toISOString() }
    }
    case 'month': {
      const from = new Date(year, mon, 1)
      const to   = new Date(year, mon + 1, 0, 23, 59, 59, 999)
      return { from: from.toISOString(), to: to.toISOString() }
    }
    case 'quarter': {
      const q     = Math.floor(mon / 3)
      const from  = new Date(year, q * 3, 1)
      const to    = new Date(year, q * 3 + 3, 0, 23, 59, 59, 999)
      return { from: from.toISOString(), to: to.toISOString() }
    }
    case 'year': {
      const from = new Date(year, 0, 1)
      const to   = new Date(year, 11, 31, 23, 59, 59, 999)
      return { from: from.toISOString(), to: to.toISOString() }
    }
  }
}

// ── 1. Overview KPIs ───────────────────────────────────────────────────────────

export interface OverviewKPIs {
  open_jobs:             number
  new_candidates:        number
  total_submissions:     number
  interviews_scheduled:  number
  offers_made:           number
  hires:                 number
  total_revenue:         number
}

export async function getOverviewKPIs(
  range: DateRange
): Promise<AnalyticsResult<OverviewKPIs>> {
  const { data, error } = await supabase.rpc('get_overview_kpis', {
    p_from: range.from,
    p_to:   range.to,
  })
  if (error) throw new Error(`getOverviewKPIs failed: ${error.message}`)

  const row = data as OverviewKPIs
  return wrap({
    open_jobs:            row.open_jobs            ?? 0,
    new_candidates:       row.new_candidates        ?? 0,
    total_submissions:    row.total_submissions      ?? 0,
    interviews_scheduled: row.interviews_scheduled  ?? 0,
    offers_made:          row.offers_made            ?? 0,
    hires:                row.hires                  ?? 0,
    total_revenue:        row.total_revenue          ?? 0,
  }, range)
}

// ── 2. Recruiter Performance ───────────────────────────────────────────────────

export interface RecruiterRow {
  recruiter_id:      string
  recruiter_name:    string
  submissions:       number
  interviews:        number
  offers:            number
  hires:             number
  revenue:           number
  avg_days_to_fill:  number | null
  iv_per_submission: number   // computed
}

export async function getRecruiterPerformance(
  range: DateRange
): Promise<AnalyticsResult<RecruiterRow[]>> {
  const { data, error } = await supabase.rpc('get_recruiter_performance', {
    p_from: range.from,
    p_to:   range.to,
  })
  if (error) throw new Error(`getRecruiterPerformance failed: ${error.message}`)

  const rows = ((data ?? []) as Omit<RecruiterRow, 'iv_per_submission'>[]).map(r => ({
    ...r,
    iv_per_submission: r.submissions > 0
      ? Math.round((r.interviews / r.submissions) * 10) / 10
      : 0,
  }))

  return wrap(rows, range)
}

// ── 3. Client Analytics ────────────────────────────────────────────────────────

export interface ClientRow {
  client_id:        string
  client_name:      string
  jobs_posted:      number
  jobs_filled:      number
  total_revenue:    number
  avg_days_to_fill: number | null
  active_pipeline:  number
}

export async function getClientAnalytics(
  range: DateRange
): Promise<AnalyticsResult<ClientRow[]>> {
  const { data, error } = await supabase.rpc('get_client_analytics', {
    p_from: range.from,
    p_to:   range.to,
  })
  if (error) throw new Error(`getClientAnalytics failed: ${error.message}`)
  return wrap((data ?? []) as ClientRow[], range)
}

// ── 4. Pipeline Funnel ─────────────────────────────────────────────────────────

export interface FunnelStage {
  stage_id:          number
  stage_name:        string
  order_index:       number
  stage_type:        string
  count:             number
  avg_days_in_stage: number | null
  conversion_rate:   number | null  // computed: this.count / prev.count * 100
}

export async function getPipelineFunnel(
  range: DateRange,
  filters?: { jobId?: string; clientId?: string; recruiterId?: string }
): Promise<AnalyticsResult<FunnelStage[]>> {
  const { data, error } = await supabase.rpc('get_pipeline_funnel', {
    p_from:         range.from,
    p_to:           range.to,
    p_job_id:       filters?.jobId      ?? null,
    p_client_id:    filters?.clientId   ?? null,
    p_recruiter_id: filters?.recruiterId ?? null,
  })
  if (error) throw new Error(`getPipelineFunnel failed: ${error.message}`)

  const raw = (data ?? []) as Omit<FunnelStage, 'conversion_rate'>[]

  // Compute conversion rates (vs previous non-zero stage)
  let prevCount: number | null = null
  const stages: FunnelStage[] = raw.map(s => {
    let rate: number | null = null
    if (prevCount != null && prevCount > 0) {
      rate = Math.round((s.count / prevCount) * 1000) / 10  // 1 decimal
    }
    if (s.count > 0) prevCount = s.count
    return { ...s, conversion_rate: rate }
  })

  return wrap(stages, range)
}

// ── 5. Source Effectiveness ────────────────────────────────────────────────────

export interface SourceRow {
  source:           string
  total_candidates: number
  applications:     number
  with_interviews:  number
  hires:            number
  conversion_rate:  number  // hires/applications * 100
}

export async function getSourceEffectiveness(
  range: DateRange
): Promise<AnalyticsResult<SourceRow[]>> {
  const { data, error } = await supabase.rpc('get_source_effectiveness', {
    p_from: range.from,
    p_to:   range.to,
  })
  if (error) throw new Error(`getSourceEffectiveness failed: ${error.message}`)
  return wrap((data ?? []) as SourceRow[], range)
}

// ── 6. Revenue Trend ───────────────────────────────────────────────────────────

export type { RevenueStats }

export async function getRevenueTrend(
  range: DateRange,
  groupBy: 'month' | 'quarter' = 'month'
): Promise<AnalyticsResult<RevenueStats>> {
  const stats = await getRevenueStats({
    from:    range.from,
    to:      range.to,
    groupBy,
  })
  return wrap(stats, range)
}
