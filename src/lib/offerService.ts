import { supabase } from './supabaseClient'
import { getPipelineStages } from './pipelineService'

// ── Types ──────────────────────────────────────────────────────────────────────

export type OfferStatus =
  | 'draft' | 'sent' | 'accepted' | 'declined' | 'withdrawn' | 'expired'

export interface Offer {
  id: string
  application_id: string
  salary: number | null
  currency: string
  bonus: number | null
  equity: string | null
  start_date: string | null
  offer_sent_at: string | null
  offer_expires_at: string | null
  status: OfferStatus
  decline_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  application?: {
    id: string
    contact: { id: string; first_name: string; last_name: string; email: string | null } | null
    job: { id: string; job_title: string; fee_type: string | null; fee_value: number | null; client_id: string | null } | null
  } | null
}

// ── Create Offer ───────────────────────────────────────────────────────────────

export async function createOffer(
  applicationId: string,
  data: {
    salary?: number | null
    currency?: string
    bonus?: number | null
    equity?: string | null
    start_date?: string | null
    offer_expires_at?: string | null
  }
): Promise<Offer> {
  // Create the offer record
  const { data: offer, error } = await supabase
    .from('offers')
    .insert({
      application_id:   applicationId,
      salary:           data.salary           ?? null,
      currency:         data.currency          ?? 'USD',
      bonus:            data.bonus             ?? null,
      equity:           data.equity            ?? null,
      start_date:       data.start_date        ?? null,
      offer_expires_at: data.offer_expires_at  ?? null,
      status:           'draft',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505')
      throw new Error('An active offer already exists for this application')
    throw new Error(`createOffer failed: ${error.message}`)
  }

  // Auto-advance application to "Offer" stage
  const stages = await getPipelineStages()
  const offerStage = stages.find(s => s.slug === 'offer')
  if (offerStage) {
    const { data: app } = await supabase
      .from('applications')
      .select('stage_id')
      .eq('id', applicationId)
      .single()

    if (app && app.stage_id !== offerStage.id) {
      await supabase
        .from('applications')
        .update({ stage_id: offerStage.id, last_stage_change_at: new Date().toISOString() })
        .eq('id', applicationId)

      await supabase.from('application_stage_history').insert({
        application_id: applicationId,
        from_stage_id:  app.stage_id,
        to_stage_id:    offerStage.id,
        reason:         'Offer created',
      })
    }
  }

  return offer as Offer
}

// ── Update Offer Status ────────────────────────────────────────────────────────

export async function updateOfferStatus(
  offerId: string,
  newStatus: OfferStatus,
  opts?: { decline_reason?: string; offer_sent_at?: string }
): Promise<Offer> {
  // Load offer with application + job data
  const { data: offer, error: fetchErr } = await supabase
    .from('offers')
    .select(`
      *,
      application:application_id (
        id, stage_id, contact_id,
        contact:contact_id (id, first_name, last_name, email),
        job:job_id (id, job_title, fee_type, fee_value, client_id, salary_currency)
      )
    `)
    .eq('id', offerId)
    .single()

  if (fetchErr) throw new Error(`updateOfferStatus fetch: ${fetchErr.message}`)

  const updatePayload: Record<string, unknown> = {
    status:     newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'sent' && opts?.offer_sent_at) {
    updatePayload.offer_sent_at = opts.offer_sent_at
  } else if (newStatus === 'sent') {
    updatePayload.offer_sent_at = new Date().toISOString()
  }
  if (newStatus === 'declined' && opts?.decline_reason) {
    updatePayload.decline_reason = opts.decline_reason
  }

  const { data: updated, error: updateErr } = await supabase
    .from('offers')
    .update(updatePayload)
    .eq('id', offerId)
    .select()
    .single()

  if (updateErr) throw new Error(`updateOfferStatus update: ${updateErr.message}`)

  // When accepted: create placement + advance to hired stage
  if (newStatus === 'accepted') {
    await _handleAcceptedOffer(offer as unknown as Offer)
  }

  return updated as Offer
}

async function _handleAcceptedOffer(offer: Offer): Promise<void> {
  const app = offer.application
  if (!app) return

  const job = app.job as any
  const applicationId = app.id

  // Calculate fee
  let feeAmount: number | null = null
  if (job?.fee_type === 'percentage' && job.fee_value != null && offer.salary != null) {
    feeAmount = (offer.salary * job.fee_value) / 100
  } else if (job?.fee_type === 'flat' && job.fee_value != null) {
    feeAmount = job.fee_value
  }

  // Calculate guarantee_expires_at
  let guaranteeExpiresAt: string | null = null
  if (offer.start_date) {
    const startDate = new Date(offer.start_date)
    startDate.setDate(startDate.getDate() + 90)
    guaranteeExpiresAt = startDate.toISOString().split('T')[0]
  }

  // Create placement
  const { error: placementErr } = await supabase
    .from('placements')
    .insert({
      application_id:       applicationId,
      offer_id:             offer.id,
      client_id:            job?.client_id ?? null,
      contact_id:           (app.contact as any)?.id ?? null,
      job_id:               job?.id ?? null,
      start_date:           offer.start_date,
      fee_amount:           feeAmount,
      currency:             offer.currency,
      guarantee_expires_at: guaranteeExpiresAt,
    })

  if (placementErr && placementErr.code !== '23505') {
    // 23505 = unique violation (placement already exists) — non-fatal
    throw new Error(`createPlacement failed: ${placementErr.message}`)
  }

  // Advance application to Hired stage + set status = 'hired'
  const stages = await getPipelineStages()
  const hiredStage = stages.find(s => s.slug === 'hired')

  const updatePayload: Record<string, unknown> = {
    status:               'hired',
    last_stage_change_at: new Date().toISOString(),
  }
  if (hiredStage) updatePayload.stage_id = hiredStage.id

  const { data: currentApp } = await supabase
    .from('applications')
    .select('stage_id')
    .eq('id', applicationId)
    .single()

  await supabase
    .from('applications')
    .update(updatePayload)
    .eq('id', applicationId)

  if (hiredStage && currentApp) {
    await supabase.from('application_stage_history').insert({
      application_id: applicationId,
      from_stage_id:  currentApp.stage_id,
      to_stage_id:    hiredStage.id,
      reason:         'Offer accepted',
    })
  }
}

// ── Getters ────────────────────────────────────────────────────────────────────

export async function getOffer(id: string): Promise<Offer | null> {
  const { data, error } = await supabase
    .from('offers')
    .select(`
      *,
      application:application_id (
        id,
        contact:contact_id (id, first_name, last_name, email),
        job:job_id (id, job_title, fee_type, fee_value, client_id)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getOffer failed: ${error.message}`)
  return (data ?? null) as unknown as Offer | null
}

export async function listOffers(filters?: {
  status?: OfferStatus
  limit?: number
}): Promise<Offer[]> {
  let query = supabase
    .from('offers')
    .select(`
      *,
      application:application_id (
        id,
        contact:contact_id (id, first_name, last_name, email),
        job:job_id (id, job_title, client:client_id(id, name))
      )
    `)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 200)

  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw new Error(`listOffers failed: ${error.message}`)
  return (data ?? []) as unknown as Offer[]
}
