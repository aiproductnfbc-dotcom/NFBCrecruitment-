import { supabase } from './supabaseClient'
import type { Job } from './jobService'

export interface DashboardStats {
  total_contacts: number
  total_employees: number
  open_requests: number
  total_requests: number
  contacts_by_department: Array<{ department: string; count: number }>
  contacts_by_seniority: Array<{ seniority_level: string; count: number }>
  top_companies: Array<{ company: string; count: number }>
  recent_uploads: Array<{
    id: string
    filename: string
    total_rows: number
    new_contacts: number
    duplicates: number
    uploaded_at: string
    employee_name: string
  }>
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('get_dashboard_stats')
  if (error) throw new Error(`getDashboardStats failed: ${error.message}`)

  const stats = data as DashboardStats
  return {
    ...stats,
    contacts_by_department: stats.contacts_by_department ?? [],
    contacts_by_seniority:  stats.contacts_by_seniority  ?? [],
    top_companies:          stats.top_companies           ?? [],
    recent_uploads:         stats.recent_uploads          ?? [],
  }
}

export interface ExtraStats {
  active_clients:     number
  total_placements:   number
  total_applications: number
  total_offers:       number
  total_interviews:   number
  jobs_by_status: { open: number; closed: number; on_hold: number }
}

export async function getExtraStats(): Promise<ExtraStats> {
  const [clients, placements, applications, offers, interviews, jobs] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).neq('status', 'churned'),
    supabase.from('placements').select('id', { count: 'exact', head: true }),
    supabase.from('applications').select('id', { count: 'exact', head: true }),
    supabase.from('offers').select('id', { count: 'exact', head: true }),
    supabase.from('interviews').select('id', { count: 'exact', head: true }),
    supabase.from('jobs').select('status'),
  ])
  const jobRows = (jobs.data ?? []) as { status: string }[]
  return {
    active_clients:     clients.count     ?? 0,
    total_placements:   placements.count  ?? 0,
    total_applications: applications.count ?? 0,
    total_offers:       offers.count      ?? 0,
    total_interviews:   interviews.count  ?? 0,
    jobs_by_status: {
      open:    jobRows.filter(j => j.status === 'open').length,
      closed:  jobRows.filter(j => j.status === 'closed').length,
      on_hold: jobRows.filter(j => j.status === 'on_hold').length,
    },
  }
}

export async function getRecentJobs(limit: number = 5): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select()
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRecentJobs failed: ${error.message}`)
  return (data ?? []) as Job[]
}

export interface ContactsPage {
  data: Array<{
    id: string
    first_name: string
    last_name: string
    email: string | null
    company: string | null
    position_raw: string | null
    linkedin_url: string | null
    connected_on: string | null
    created_at: string
    phone: string | null
    contact_type: string
    candidate_status: string | null
    current_title: string | null
    current_company: string | null
    owner_id: string | null
    candidate_source: string | null
    categorized_positions: {
      normalized_title: string | null
      seniority_level: string | null
      department: string | null
    } | null
  }>
  count: number
}

export async function fetchAllContactsForExport(params: {
  department?: string
  seniority?: string
  company?: string
  search?: string
  contact_type?: string
  candidate_status?: string
}): Promise<ContactsPage['data']> {
  const BATCH = 1000
  const allFiltered: ContactsPage['data'] = []
  let offset = 0
  let totalDB = Infinity

  while (offset < totalDB) {
    let query = supabase
      .from('contacts')
      .select(
        `id, first_name, last_name, email, company, position_raw, linkedin_url, connected_on, created_at,
         phone, contact_type, candidate_status, current_title, current_company, owner_id, candidate_source,
         categorized_positions (normalized_title, seniority_level, department)`,
        { count: offset === 0 ? 'exact' : undefined }
      )
      .range(offset, offset + BATCH - 1)
      .order('created_at', { ascending: false })

    if (params.company)          query = query.ilike('company', `%${params.company}%`)
    if (params.search)           query = query.textSearch('search_vector', params.search, { type: 'plain' })
    if (params.contact_type)     query = query.eq('contact_type', params.contact_type)
    if (params.candidate_status) query = query.eq('candidate_status', params.candidate_status)

    const { data, error, count } = await query
    if (error) throw new Error(`fetchAllContactsForExport failed: ${error.message}`)

    if (offset === 0 && count !== null) totalDB = count

    let rows = (data ?? []) as unknown as ContactsPage['data']
    if (params.department) rows = rows.filter(r => r.categorized_positions?.department?.toLowerCase() === params.department!.toLowerCase())
    if (params.seniority)  rows = rows.filter(r => r.categorized_positions?.seniority_level?.toLowerCase() === params.seniority!.toLowerCase())

    allFiltered.push(...rows)
    offset += BATCH
    if ((data ?? []).length < BATCH) break
  }

  return allFiltered
}

export async function browseContacts(params: {
  page: number
  pageSize: number
  department?: string
  seniority?: string
  company?: string
  search?: string
  contact_type?: string
  candidate_status?: string
  owner_id?: string
  candidate_source?: string
  skill_id?: string
}): Promise<ContactsPage> {
  const { page, pageSize, department, seniority, company, search,
          contact_type, candidate_status, owner_id, candidate_source, skill_id } = params
  const from = page * pageSize
  const to   = from + pageSize - 1

  // Skill filter — subquery to get contact IDs with this skill
  let skillContactIds: string[] | null = null
  if (skill_id) {
    const { data: skilled } = await supabase
      .from('contact_skills')
      .select('contact_id')
      .eq('skill_id', skill_id)
    skillContactIds = (skilled ?? []).map((r: any) => r.contact_id as string)
    if (!skillContactIds.length) return { data: [], count: 0 }
  }

  let query = supabase
    .from('contacts')
    .select(
      `id, first_name, last_name, email, company, position_raw, linkedin_url, connected_on, created_at,
       phone, contact_type, candidate_status, current_title, current_company, owner_id, candidate_source,
       categorized_positions (normalized_title, seniority_level, department)`,
      { count: 'exact' }
    )
    .range(from, to)
    .order('created_at', { ascending: false })

  if (company)          query = query.ilike('company', `%${company}%`)
  if (search) {
    // PostgreSQL's English text-search config treats short common words like
    // "IT", "AI", "HR" as stop words and silently drops them, returning 0 rows.
    // For short terms (≤3 chars) fall back to ILIKE on key text columns so
    // "IT Manager", "AI Engineer" etc. are still found.
    if (search.trim().length <= 3) {
      const term = search.trim()
      query = query.or(
        `position_raw.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%,current_title.ilike.%${term}%`
      )
    } else {
      query = query.textSearch('search_vector', search, { type: 'plain' })
    }
  }
  if (contact_type)     query = query.eq('contact_type', contact_type)
  if (candidate_status) query = query.eq('candidate_status', candidate_status)
  if (owner_id)         query = query.eq('owner_id', owner_id)
  if (candidate_source) query = query.eq('candidate_source', candidate_source)
  if (skillContactIds)  query = query.in('id', skillContactIds)

  const { data, error, count } = await query
  if (error) throw new Error(`browseContacts failed: ${error.message}`)

  let rows = (data ?? []) as unknown as ContactsPage['data']

  // Department and seniority are on the joined categorized_positions — filter client-side
  if (department) {
    rows = rows.filter(
      r => r.categorized_positions?.department?.toLowerCase() === department.toLowerCase()
    )
  }
  if (seniority) {
    rows = rows.filter(
      r => r.categorized_positions?.seniority_level?.toLowerCase() === seniority.toLowerCase()
    )
  }

  return { data: rows, count: count ?? 0 }
}
