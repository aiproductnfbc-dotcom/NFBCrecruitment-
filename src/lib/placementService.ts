import { supabase } from './supabaseClient'

// ── Types ──────────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'pending' | 'invoiced' | 'paid' | 'disputed'
export type PlacementStatus = 'active' | 'ended' | 'replaced_under_guarantee'

export interface Placement {
  id: string
  application_id: string
  offer_id: string | null
  client_id: string | null
  contact_id: string | null
  job_id: string | null
  start_date: string | null
  end_date_expected: string | null
  fee_amount: number | null
  currency: string
  invoice_status: InvoiceStatus
  invoiced_at: string | null
  paid_at: string | null
  guarantee_period_days: number
  guarantee_expires_at: string | null
  status: PlacementStatus
  created_at: string
  updated_at: string
  // joined
  contact?: { id: string; first_name: string; last_name: string; email: string | null } | null
  job?: { id: string; job_title: string; department: string | null } | null
  client?: { id: string; name: string } | null
  offer?: { id: string; salary: number | null; currency: string } | null
}

export interface RevenueStats {
  totals: {
    placement_count: number
    total_revenue: number
    avg_fee: number
    paid_revenue: number
    invoiced_revenue: number
    pending_revenue: number
  }
  breakdown: Array<{
    group_key: string
    count: number
    revenue: number
    paid: number
  }>
}

const PLACEMENT_SELECT = `
  *,
  contact:contact_id (id, first_name, last_name, email),
  job:job_id (id, job_title, department),
  client:client_id (id, name),
  offer:offer_id (id, salary, currency)
`

// ── Get ────────────────────────────────────────────────────────────────────────

export async function getPlacement(id: string): Promise<Placement | null> {
  const { data, error } = await supabase
    .from('placements')
    .select(PLACEMENT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getPlacement failed: ${error.message}`)
  return (data ?? null) as unknown as Placement | null
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listPlacements(filters?: {
  client_id?:      string
  invoice_status?: InvoiceStatus
  status?:         PlacementStatus
  from?:           string   // ISO date
  to?:             string   // ISO date
  limit?:          number
}): Promise<Placement[]> {
  let query = supabase
    .from('placements')
    .select(PLACEMENT_SELECT)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 200)

  if (filters?.client_id)      query = query.eq('client_id', filters.client_id)
  if (filters?.invoice_status) query = query.eq('invoice_status', filters.invoice_status)
  if (filters?.status)         query = query.eq('status', filters.status)
  if (filters?.from)           query = query.gte('created_at', filters.from)
  if (filters?.to)             query = query.lte('created_at', filters.to)

  const { data, error } = await query
  if (error) throw new Error(`listPlacements failed: ${error.message}`)
  return (data ?? []) as unknown as Placement[]
}

// ── Invoice status ─────────────────────────────────────────────────────────────

export async function updateInvoiceStatus(
  placementId: string,
  status: InvoiceStatus,
  date?: string
): Promise<Placement> {
  const payload: Record<string, unknown> = { invoice_status: status }

  if (status === 'invoiced') {
    payload.invoiced_at = date ?? new Date().toISOString()
  } else if (status === 'paid') {
    payload.paid_at = date ?? new Date().toISOString()
    // Ensure invoiced_at is set when marking as paid
    const { data: existing } = await supabase
      .from('placements')
      .select('invoiced_at')
      .eq('id', placementId)
      .single()
    if (!existing?.invoiced_at) {
      payload.invoiced_at = payload.paid_at
    }
  }

  const { data, error } = await supabase
    .from('placements')
    .update(payload)
    .eq('id', placementId)
    .select(PLACEMENT_SELECT)
    .single()

  if (error) throw new Error(`updateInvoiceStatus failed: ${error.message}`)
  return data as unknown as Placement
}

// ── Revenue stats ──────────────────────────────────────────────────────────────

export async function getRevenueStats(opts?: {
  from?: string
  to?: string
  groupBy?: 'month' | 'quarter' | 'recruiter' | 'client'
}): Promise<RevenueStats> {
  const { data, error } = await supabase.rpc('get_revenue_stats', {
    p_from:     opts?.from     ?? null,
    p_to:       opts?.to       ?? null,
    p_group_by: opts?.groupBy  ?? 'month',
  })

  if (error) throw new Error(`getRevenueStats failed: ${error.message}`)

  const result = data as { totals: RevenueStats['totals']; breakdown: RevenueStats['breakdown'] }
  return {
    totals: {
      placement_count: result.totals?.placement_count ?? 0,
      total_revenue:   result.totals?.total_revenue   ?? 0,
      avg_fee:         result.totals?.avg_fee          ?? 0,
      paid_revenue:    result.totals?.paid_revenue     ?? 0,
      invoiced_revenue:result.totals?.invoiced_revenue ?? 0,
      pending_revenue: result.totals?.pending_revenue  ?? 0,
    },
    breakdown: result.breakdown ?? [],
  }
}
