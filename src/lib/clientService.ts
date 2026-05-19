import { supabase } from './supabaseClient'
import { createActivity } from './activityService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  name: string
  legal_name: string | null
  industry: string | null
  website: string | null
  size_bucket: string | null
  country: string | null
  city: string | null
  address: string | null
  status: 'prospect' | 'active' | 'on_hold' | 'churned'
  tier: 'A' | 'B' | 'C' | null
  account_manager_id: string | null
  source: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ClientContact {
  id: string
  client_id: string
  first_name: string
  last_name: string
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  is_primary: boolean
  status: string
  created_at: string
  updated_at: string
}

export interface ClientDetail {
  client: Client
  contacts: ClientContact[]
  open_jobs_count: number
  total_jobs_count: number
  last_activity_at: string | null
  account_manager: { id: string; full_name: string | null; email: string } | null
}

// ─── Client list ──────────────────────────────────────────────────────────────

export interface ClientListParams {
  status?: string[]
  tier?: string[]
  account_manager_id?: string
  industry?: string
  tag_id?: string
  search?: string
  page?: number
  pageSize?: number
}

export async function getClients(params: ClientListParams = {}): Promise<{ data: Client[]; count: number }> {
  const { status, tier, account_manager_id, industry, tag_id, search, page = 0, pageSize = 50 } = params
  const from = page * pageSize
  const to   = from + pageSize - 1

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('name')
    .range(from, to)

  if (status?.length)        query = query.in('status', status)
  if (tier?.length)          query = query.in('tier', tier)
  if (account_manager_id)    query = query.eq('account_manager_id', account_manager_id)
  if (industry)              query = query.ilike('industry', `%${industry}%`)
  if (search)                query = query.or(`name.ilike.%${search}%,legal_name.ilike.%${search}%`)

  // Tag filter — requires a subquery via entity_tags
  if (tag_id) {
    const { data: tagged } = await supabase
      .from('entity_tags')
      .select('entity_id')
      .eq('entity_type', 'client')
      .eq('tag_id', tag_id)

    const ids = (tagged ?? []).map((r: any) => r.entity_id as string)
    if (!ids.length) return { data: [], count: 0 }
    query = query.in('id', ids)
  }

  const { data, error, count } = await query
  if (error) throw new Error(`getClients failed: ${error.message}`)
  return { data: (data ?? []) as Client[], count: count ?? 0 }
}

// ─── Client detail ────────────────────────────────────────────────────────────

export async function getClientDetail(clientId: string): Promise<ClientDetail> {
  const [clientRes, contactsRes, jobsRes, activityRes] = await Promise.all([
    supabase
      .from('clients')
      .select(`*, account_manager:profiles!clients_account_manager_id_fkey(id, full_name, email)`)
      .eq('id', clientId)
      .single(),

    supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('last_name'),

    supabase
      .from('jobs')
      .select('id, status', { count: 'exact' })
      .eq('client_id', clientId),

    supabase
      .from('activities')
      .select('occurred_at')
      .eq('subject_type', 'client')
      .eq('subject_id', clientId)
      .order('occurred_at', { ascending: false })
      .limit(1),
  ])

  if (clientRes.error) throw new Error(`getClientDetail failed: ${clientRes.error.message}`)

  const raw = clientRes.data as any
  const client = { ...raw, account_manager: undefined } as Client
  const accountManager = raw.account_manager ?? null

  const jobs = (jobsRes.data ?? []) as Array<{ id: string; status: string }>
  const openJobsCount  = jobs.filter(j => j.status === 'open').length
  const totalJobsCount = jobs.length
  const lastActivityAt = activityRes.data?.[0]?.occurred_at ?? null

  return {
    client,
    contacts:         (contactsRes.data ?? []) as ClientContact[],
    open_jobs_count:  openJobsCount,
    total_jobs_count: totalJobsCount,
    last_activity_at: lastActivityAt,
    account_manager:  accountManager,
  }
}

// ─── Client CRUD ──────────────────────────────────────────────────────────────

export async function createClient(data: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Promise<Client> {
  const { data: row, error } = await supabase
    .from('clients')
    .insert({ ...data, status: data.status ?? 'prospect' })
    .select()
    .single()

  if (error) throw new Error(`createClient failed: ${error.message}`)
  return row as Client
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client> {
  const { data: row, error } = await supabase
    .from('clients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateClient failed: ${error.message}`)
  return row as Client
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`deleteClient failed: ${error.message}`)
}

// ─── assignAccountManager ─────────────────────────────────────────────────────

export async function assignAccountManager(
  clientId: string,
  userId: string,
  userName: string
): Promise<void> {
  await updateClient(clientId, { account_manager_id: userId })

  await createActivity({
    subject_type:  'client',
    subject_id:    clientId,
    activity_type: 'status_change',
    title:         `Account manager changed to ${userName}`,
  })
}

// ─── Client contacts CRUD ─────────────────────────────────────────────────────

export async function createClientContact(data: Omit<ClientContact, 'id' | 'created_at' | 'updated_at'>): Promise<ClientContact> {
  const { data: row, error } = await supabase
    .from('client_contacts')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`createClientContact failed: ${error.message}`)
  return row as ClientContact
}

export async function updateClientContact(id: string, data: Partial<ClientContact>): Promise<ClientContact> {
  const { data: row, error } = await supabase
    .from('client_contacts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateClientContact failed: ${error.message}`)
  return row as ClientContact
}

export async function deleteClientContact(id: string): Promise<void> {
  const { error } = await supabase.from('client_contacts').delete().eq('id', id)
  if (error) throw new Error(`deleteClientContact failed: ${error.message}`)
}

export async function setPrimaryContact(clientId: string, contactId: string): Promise<void> {
  // Clear existing primary on this client, then set new one
  await supabase
    .from('client_contacts')
    .update({ is_primary: false })
    .eq('client_id', clientId)

  await supabase
    .from('client_contacts')
    .update({ is_primary: true })
    .eq('id', contactId)
}
