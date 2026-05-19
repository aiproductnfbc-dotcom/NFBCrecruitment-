import { supabase } from './supabaseClient'

export interface ShortlistEntry {
  id: string
  request_id: string
  contact_id: string
  match_score: number
  status: 'new' | 'contacted' | 'interested' | 'rejected' | 'placed'
  notes: string | null
  created_at: string
  updated_at: string
  contact?: {
    first_name: string
    last_name: string
    email: string | null
    company: string | null
    position_raw: string | null
    linkedin_url: string | null
  }
  categorization?: {
    normalized_title: string | null
    seniority_level: string | null
    department: string | null
  }
}

export async function addToShortlist(
  requestId: string,
  candidates: Array<{ contact_id: string; match_score: number }>
): Promise<ShortlistEntry[]> {
  if (!candidates.length) return []

  const rows = candidates.map(c => ({
    request_id:  requestId,
    contact_id:  c.contact_id,
    match_score: c.match_score,
    status:      'new' as const,
  }))

  const { data, error } = await supabase
    .from('shortlists')
    .upsert(rows, { onConflict: 'request_id,contact_id', ignoreDuplicates: true })
    .select()

  if (error) throw new Error(`addToShortlist failed: ${error.message}`)
  return (data ?? []) as ShortlistEntry[]
}

export async function getShortlist(requestId: string): Promise<ShortlistEntry[]> {
  const { data, error } = await supabase
    .from('shortlists')
    .select(`
      *,
      contacts (
        first_name, last_name, email, company, position_raw, linkedin_url,
        categorized_positions (
          normalized_title, seniority_level, department
        )
      )
    `)
    .eq('request_id', requestId)
    .order('match_score', { ascending: false })

  if (error) throw new Error(`getShortlist failed: ${error.message}`)

  return ((data ?? []) as any[]).map(row => ({
    ...row,
    contact:        row.contacts ? {
      first_name:   row.contacts.first_name,
      last_name:    row.contacts.last_name,
      email:        row.contacts.email,
      company:      row.contacts.company,
      position_raw: row.contacts.position_raw,
      linkedin_url: row.contacts.linkedin_url,
    } : undefined,
    categorization: row.contacts?.categorized_positions ?? undefined,
    contacts:             undefined,
  })) as ShortlistEntry[]
}

export async function updateShortlistStatus(
  shortlistId: string,
  status: ShortlistEntry['status']
): Promise<ShortlistEntry> {
  const { data, error } = await supabase
    .from('shortlists')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', shortlistId)
    .select()
    .single()

  if (error) throw new Error(`updateShortlistStatus failed: ${error.message}`)
  return data as ShortlistEntry
}

export async function updateShortlistNotes(
  shortlistId: string,
  notes: string
): Promise<ShortlistEntry> {
  const { data, error } = await supabase
    .from('shortlists')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', shortlistId)
    .select()
    .single()

  if (error) throw new Error(`updateShortlistNotes failed: ${error.message}`)
  return data as ShortlistEntry
}

export async function removeFromShortlist(shortlistId: string): Promise<void> {
  const { error } = await supabase
    .from('shortlists')
    .delete()
    .eq('id', shortlistId)

  if (error) throw new Error(`removeFromShortlist failed: ${error.message}`)
}

export async function getShortlistStats(requestId: string): Promise<{
  total: number
  new: number
  contacted: number
  interested: number
  rejected: number
  placed: number
}> {
  const { data, error } = await supabase
    .from('shortlists')
    .select('status')
    .eq('request_id', requestId)

  if (error) throw new Error(`getShortlistStats failed: ${error.message}`)

  const rows = (data ?? []) as Array<{ status: string }>
  const count = (s: string) => rows.filter(r => r.status === s).length

  return {
    total:     rows.length,
    new:       count('new'),
    contacted: count('contacted'),
    interested: count('interested'),
    rejected:  count('rejected'),
    placed:    count('placed'),
  }
}
