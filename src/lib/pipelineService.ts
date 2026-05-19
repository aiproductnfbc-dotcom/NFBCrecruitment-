import { supabase } from './supabaseClient'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PipelineStage {
  id: number
  name: string
  slug: string
  order_index: number
  stage_type: string
  is_active: boolean
}

export interface Application {
  id: string
  contact_id: string
  job_id: string
  stage_id: number
  status: 'active' | 'rejected' | 'withdrawn' | 'hired'
  rejection_reason: string | null
  applied_at: string
  source: string | null
  last_stage_change_at: string
  created_at: string
  updated_at: string
}

export interface ApplicationStageHistory {
  id: string
  application_id: string
  from_stage_id: number | null
  to_stage_id: number
  moved_by: string | null
  reason: string | null
  moved_at: string
  from_stage?: PipelineStage | null
  to_stage?: PipelineStage
  mover?: { id: string; full_name: string | null } | null
}

export interface Scorecard {
  id: string
  application_id: string
  reviewer_id: string | null
  technical_score: number | null
  culture_score: number | null
  communication_score: number | null
  overall_score: number | null
  recommendation: 'strong_yes' | 'yes' | 'no' | 'strong_no' | null
  notes: string | null
  submitted_at: string
  updated_at: string
  reviewer?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export interface KanbanCard {
  id: string
  contact_id: string
  status: 'active' | 'rejected' | 'withdrawn' | 'hired'
  stage_id: number
  applied_at: string
  last_stage_change_at: string
  days_in_stage: number
  source: string | null
  contact: {
    first_name: string
    last_name: string
    email: string | null
    current_title: string | null
    current_company: string | null
  }
}

export interface KanbanColumn {
  stage: PipelineStage
  cards: KanbanCard[]
}

export interface PipelineMetrics {
  stage_id: number
  stage_name: string
  count: number
  avg_days: number
}

// ── Stage cache ────────────────────────────────────────────────────────────────

let _stageCache: PipelineStage[] | null = null

export async function getPipelineStages(): Promise<PipelineStage[]> {
  if (_stageCache) return _stageCache
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select()
    .eq('is_active', true)
    .order('order_index', { ascending: true })
  if (error) throw new Error(`getPipelineStages failed: ${error.message}`)
  _stageCache = (data ?? []) as PipelineStage[]
  return _stageCache
}

export function invalidateStageCache() {
  _stageCache = null
}

// ── Apply ──────────────────────────────────────────────────────────────────────

export async function applyContactToJob(
  contactId: string,
  jobId: string,
  stageSlug = 'sourced',
  source?: string
): Promise<Application> {
  const stages = await getPipelineStages()
  const stage = stages.find(s => s.slug === stageSlug) ?? stages[0]
  if (!stage) throw new Error('No pipeline stages configured')

  const { data, error } = await supabase
    .from('applications')
    .insert({
      contact_id: contactId,
      job_id: jobId,
      stage_id: stage.id,
      source: source ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505')
      throw new Error('This candidate is already in the pipeline for this job')
    throw new Error(`applyContactToJob failed: ${error.message}`)
  }

  // Record initial placement in audit trail
  await supabase.from('application_stage_history').insert({
    application_id: (data as Application).id,
    from_stage_id: null,
    to_stage_id: stage.id,
    reason: 'Initial placement',
  })

  return data as Application
}

// ── Move Stage ─────────────────────────────────────────────────────────────────

export async function moveApplicationStage(
  applicationId: string,
  newStageId: number,
  opts?: { reason?: string; isAdmin?: boolean }
): Promise<Application> {
  const { data: app, error: fetchErr } = await supabase
    .from('applications')
    .select('id, stage_id, status')
    .eq('id', applicationId)
    .single()

  if (fetchErr) throw new Error(`moveApplicationStage: ${fetchErr.message}`)

  // Locked states block all moves
  if (app.status === 'hired' || app.status === 'rejected') {
    throw new Error(`Cannot move an application with status '${app.status}'`)
  }

  const stages = await getPipelineStages()
  const currentStage = stages.find(s => s.id === app.stage_id)
  const targetStage  = stages.find(s => s.id === newStageId)

  if (!targetStage) throw new Error(`Stage ${newStageId} not found`)

  // Backward move validation
  const isBackward = currentStage != null && targetStage.order_index < currentStage.order_index
  if (isBackward && !opts?.isAdmin) {
    throw new Error('Backward stage moves require admin permission')
  }
  if (isBackward && !opts?.reason?.trim()) {
    throw new Error('A reason is required when moving a candidate backward in the pipeline')
  }

  const { data: updated, error: updateErr } = await supabase
    .from('applications')
    .update({ stage_id: newStageId, last_stage_change_at: new Date().toISOString() })
    .eq('id', applicationId)
    .select()
    .single()

  if (updateErr) throw new Error(`moveApplicationStage update: ${updateErr.message}`)

  // Audit trail
  await supabase.from('application_stage_history').insert({
    application_id: applicationId,
    from_stage_id: app.stage_id,
    to_stage_id: newStageId,
    reason: opts?.reason ?? null,
  })

  return updated as Application
}

// ── Bulk Move ──────────────────────────────────────────────────────────────────

export async function bulkMoveStage(
  applicationIds: string[],
  newStageId: number
): Promise<void> {
  if (applicationIds.length === 0) return
  if (applicationIds.length > 50)
    throw new Error('Cannot bulk move more than 50 applications at once')

  const { error } = await supabase
    .from('applications')
    .update({ stage_id: newStageId, last_stage_change_at: new Date().toISOString() })
    .in('id', applicationIds)
    .eq('status', 'active')

  if (error) throw new Error(`bulkMoveStage failed: ${error.message}`)

  const historyRows = applicationIds.map(id => ({
    application_id: id,
    to_stage_id: newStageId,
    reason: 'Bulk move',
  }))
  await supabase.from('application_stage_history').insert(historyRows)
}

// ── Reject ─────────────────────────────────────────────────────────────────────

export async function rejectApplication(
  applicationId: string,
  reason: string
): Promise<Application> {
  const stages = await getPipelineStages()
  const rejectedStage = stages.find(s => s.slug === 'rejected')

  const payload: Record<string, unknown> = {
    status: 'rejected',
    rejection_reason: reason,
    last_stage_change_at: new Date().toISOString(),
  }
  if (rejectedStage) payload.stage_id = rejectedStage.id

  const { data, error } = await supabase
    .from('applications')
    .update(payload)
    .eq('id', applicationId)
    .select()
    .single()

  if (error) throw new Error(`rejectApplication failed: ${error.message}`)

  if (rejectedStage) {
    await supabase.from('application_stage_history').insert({
      application_id: applicationId,
      to_stage_id: rejectedStage.id,
      reason: `Rejected: ${reason}`,
    })
  }

  return data as Application
}

// ── Scorecards ─────────────────────────────────────────────────────────────────

export async function submitScorecard(
  applicationId: string,
  reviewerId: string,
  scores: {
    technical_score?: number | null
    culture_score?: number | null
    communication_score?: number | null
    overall_score?: number | null
  },
  recommendation?: 'strong_yes' | 'yes' | 'no' | 'strong_no' | null,
  notes?: string | null
): Promise<Scorecard> {
  const payload = {
    application_id: applicationId,
    reviewer_id: reviewerId,
    ...scores,
    recommendation: recommendation ?? null,
    notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('application_scorecards')
    .upsert(payload, { onConflict: 'application_id,reviewer_id' })
    .select()
    .single()

  if (error) throw new Error(`submitScorecard failed: ${error.message}`)
  return data as Scorecard
}

export async function getScorecardsForApplication(applicationId: string): Promise<Scorecard[]> {
  const { data, error } = await supabase
    .from('application_scorecards')
    .select('*, reviewer:reviewer_id(id, full_name, avatar_url)')
    .eq('application_id', applicationId)
    .order('submitted_at', { ascending: true })

  if (error) throw new Error(`getScorecardsForApplication failed: ${error.message}`)
  return (data ?? []) as unknown as Scorecard[]
}

// ── Kanban ─────────────────────────────────────────────────────────────────────

export async function getJobPipeline(jobId: string): Promise<KanbanColumn[]> {
  const [stages, { data: apps, error }] = await Promise.all([
    getPipelineStages(),
    supabase
      .from('applications')
      .select(`
        id, contact_id, status, stage_id, applied_at, last_stage_change_at, source,
        contact:contact_id (first_name, last_name, email, current_title, current_company)
      `)
      .eq('job_id', jobId)
      .order('last_stage_change_at', { ascending: true }),
  ])

  if (error) throw new Error(`getJobPipeline failed: ${error.message}`)

  const now = Date.now()
  const cards: KanbanCard[] = (apps ?? []).map((a: any) => ({
    id: a.id,
    contact_id: a.contact_id,
    status: a.status,
    stage_id: a.stage_id,
    applied_at: a.applied_at,
    last_stage_change_at: a.last_stage_change_at,
    days_in_stage: Math.floor(
      (now - new Date(a.last_stage_change_at).getTime()) / 86_400_000
    ),
    source: a.source ?? null,
    contact: a.contact ?? {
      first_name: 'Unknown',
      last_name: '',
      email: null,
      current_title: null,
      current_company: null,
    },
  }))

  return stages.map(stage => ({
    stage,
    cards: cards.filter(c => c.stage_id === stage.id),
  }))
}

// ── Metrics ────────────────────────────────────────────────────────────────────

export async function getJobPipelineMetrics(jobId: string): Promise<PipelineMetrics[]> {
  const [stages, { data: apps, error }] = await Promise.all([
    getPipelineStages(),
    supabase
      .from('applications')
      .select('stage_id, last_stage_change_at')
      .eq('job_id', jobId),
  ])

  if (error) throw new Error(`getJobPipelineMetrics failed: ${error.message}`)

  const now = Date.now()
  const byStage = new Map<number, number[]>()
  for (const app of apps ?? []) {
    const days = Math.floor(
      (now - new Date(app.last_stage_change_at).getTime()) / 86_400_000
    )
    if (!byStage.has(app.stage_id)) byStage.set(app.stage_id, [])
    byStage.get(app.stage_id)!.push(days)
  }

  return stages.map(s => {
    const counts = byStage.get(s.id) ?? []
    return {
      stage_id: s.id,
      stage_name: s.name,
      count: counts.length,
      avg_days:
        counts.length
          ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
          : 0,
    }
  })
}

// ── Stage History for Application ──────────────────────────────────────────────

export async function getApplicationHistory(applicationId: string): Promise<ApplicationStageHistory[]> {
  const { data, error } = await supabase
    .from('application_stage_history')
    .select(`
      *,
      from_stage:from_stage_id(id, name, slug),
      to_stage:to_stage_id(id, name, slug),
      mover:moved_by(id, full_name)
    `)
    .eq('application_id', applicationId)
    .order('moved_at', { ascending: true })

  if (error) throw new Error(`getApplicationHistory failed: ${error.message}`)
  return (data ?? []) as unknown as ApplicationStageHistory[]
}
