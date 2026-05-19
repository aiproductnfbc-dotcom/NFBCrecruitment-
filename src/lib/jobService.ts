import { supabase } from './supabaseClient'

export type EmploymentType =
  | 'full_time' | 'part_time' | 'contract' | 'temp'
  | 'permanent' | 'temporary' | 'internship' | 'executive'

export interface Job {
  id: string
  job_title: string
  department: string | null
  seniority: string | null
  keywords: string[]
  description: string | null
  status: 'open' | 'closed' | 'on_hold'
  // Batch 1b extended fields
  client_id: string | null
  employment_type: EmploymentType | null
  location: string | null
  remote_policy: 'onsite' | 'hybrid' | 'remote' | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  fee_type: 'percentage' | 'flat' | null
  fee_value: number | null
  priority: 'low' | 'normal' | 'high' | 'urgent' | null
  opened_at: string | null
  target_close_date: string | null
  closed_at: string | null
  owner_id: string | null
  hiring_manager_contact_id: string | null
  created_at: string
  updated_at: string
  // Batch 7: publish-to-job-board fields
  is_published_to_job_board: boolean
  published_at: string | null
  slug: string | null
  public_title: string | null
  public_description: string | null
  public_location: string | null
  public_salary_min: number | null
  public_salary_max: number | null
  public_salary_currency: string | null
  public_salary_visible: boolean
  seniority_public: string | null
  apply_deadline: string | null
}

export function getPublicJobUrl(slug: string): string {
  const base = import.meta.env.VITE_SITE_URL || window.location.origin
  return `${base}/jobs/${slug}`
}

export async function createJob(data: {
  job_title: string
  department?: string
  seniority?: string
  keywords?: string[]
  description?: string
  client_id?: string | null
}): Promise<Job> {
  const { data: row, error } = await supabase
    .from('jobs')
    .insert({
      job_title:   data.job_title,
      department:  data.department  ?? null,
      seniority:   data.seniority   ?? null,
      keywords:    data.keywords    ?? [],
      description: data.description ?? null,
      client_id:   data.client_id   ?? null,
      status:      'open',
    })
    .select()
    .single()

  if (error) throw new Error(`createJob failed: ${error.message}`)
  return row as Job
}

export async function getJobs(
  status?: 'open' | 'closed' | 'on_hold'
): Promise<Job[]> {
  let query = supabase
    .from('jobs')
    .select()
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(`getJobs failed: ${error.message}`)
  return (data ?? []) as Job[]
}

export async function getJobById(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getJobById failed: ${error.message}`)
  return (data ?? null) as Job | null
}

export async function updateJob(
  id: string,
  data: Partial<Job>
): Promise<Job> {
  const { data: row, error } = await supabase
    .from('jobs')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateJob failed: ${error.message}`)
  return row as Job
}

export async function deleteJob(id: string): Promise<void> {
  // All child tables (applications, placements, shortlists and their descendants)
  // use ON DELETE CASCADE, so a single delete is sufficient.
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`deleteJob failed: ${error.message}`)
}
