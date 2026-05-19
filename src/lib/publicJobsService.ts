import { supabase } from './supabaseClient'

export interface PublicJob {
  id: string
  slug: string
  title: string
  description: string | null
  location: string | null
  employment_type: string | null
  remote_policy: 'onsite' | 'hybrid' | 'remote' | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  seniority: string | null
  apply_deadline: string | null
  published_at: string | null
  created_at: string
}

export interface ListPublicJobsParams {
  keyword?: string
  employment_type?: PublicJob['employment_type']
  remote_policy?: PublicJob['remote_policy']
  seniority?: string
  location?: string
  sort?: 'newest' | 'closing_soon'
  limit?: number
  offset?: number
}

export interface ListPublicJobsResult {
  jobs: PublicJob[]
  total: number
}

function sanitizeIlike(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function listPublicJobs(
  params: ListPublicJobsParams = {}
): Promise<ListPublicJobsResult> {
  const {
    keyword,
    employment_type,
    remote_policy,
    seniority,
    location,
    sort = 'newest',
    limit = 12,
    offset = 0,
  } = params

  try {
    let query = supabase
      .from('public_jobs')
      .select('*', { count: 'exact' })

    if (keyword) {
      const kw = sanitizeIlike(keyword)
      query = query.or(
        `title.ilike.%${kw}%,location.ilike.%${kw}%,seniority.ilike.%${kw}%,description.ilike.%${kw}%`
      )
    }

    if (employment_type) query = query.eq('employment_type', employment_type)
    if (remote_policy) query = query.eq('remote_policy', remote_policy)
    if (seniority) query = query.eq('seniority', seniority)
    if (location) {
      query = query.ilike('location', `%${sanitizeIlike(location)}%`)
    }

    if (sort === 'closing_soon') {
      query = query
        .order('apply_deadline', { ascending: true, nullsFirst: false })
        .order('published_at', { ascending: false })
    } else {
      query = query.order('published_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      if (import.meta.env.DEV) console.error('listPublicJobs error:', error)
      return { jobs: [], total: 0 }
    }

    return { jobs: (data ?? []) as PublicJob[], total: count ?? 0 }
  } catch (e) {
    if (import.meta.env.DEV) console.error('listPublicJobs exception:', e)
    return { jobs: [], total: 0 }
  }
}

export async function listFeaturedPublicJobs(limit = 6): Promise<PublicJob[]> {
  const { jobs } = await listPublicJobs({ sort: 'newest', limit, offset: 0 })
  return jobs
}

export async function listRelatedPublicJobs(
  currentSlug: string,
  currentEmploymentType: PublicJob['employment_type'] | null,
  limit = 3
): Promise<PublicJob[]> {
  try {
    const results: PublicJob[] = []
    const excludeSlugs = [currentSlug]

    // First: try same employment type
    if (currentEmploymentType) {
      const { data, error } = await supabase
        .from('public_jobs')
        .select()
        .eq('employment_type', currentEmploymentType)
        .not('slug', 'eq', currentSlug)
        .order('published_at', { ascending: false })
        .limit(limit)

      if (!error && data) {
        for (const row of data as PublicJob[]) {
          results.push(row)
          excludeSlugs.push(row.slug)
        }
      }
    }

    // Top up if needed
    if (results.length < limit) {
      const remaining = limit - results.length
      let topUpQuery = supabase
        .from('public_jobs')
        .select()
        .order('published_at', { ascending: false })
        .limit(remaining)

      for (const slug of excludeSlugs) {
        topUpQuery = topUpQuery.not('slug', 'eq', slug)
      }

      const { data, error } = await topUpQuery
      if (!error && data) {
        results.push(...(data as PublicJob[]))
      }
    }

    return results.slice(0, limit)
  } catch {
    return []
  }
}

export async function getPublicJobBySlug(slug: string): Promise<PublicJob | null> {
  const { data, error } = await supabase
    .rpc('get_public_job_by_slug', { p_slug: slug })

  if (error) throw new Error(`getPublicJobBySlug failed: ${error.message}`)
  const rows = data as PublicJob[] | null
  return rows?.[0] ?? null
}

export function formatSalary(job: PublicJob): string | null {
  if (job.salary_min == null && job.salary_max == null) return null
  const fmt = (n: number) => n.toLocaleString()
  const currency = job.salary_currency ?? ''
  if (job.salary_min != null && job.salary_max != null) {
    return `${currency} ${fmt(job.salary_min)} – ${fmt(job.salary_max)}`
  }
  if (job.salary_min != null) return `From ${currency} ${fmt(job.salary_min)}`
  return `Up to ${currency} ${fmt(job.salary_max!)}`
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1mo ago' : `${months}mo ago`
}
