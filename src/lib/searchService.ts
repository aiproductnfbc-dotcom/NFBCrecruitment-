import { supabase } from './supabaseClient'
import { fuzzyMatchTitle } from './categorize'
import { createJob, type Job } from './jobService'

export interface CandidateMatch {
  contact_id: string
  first_name: string
  last_name: string
  email: string | null
  company: string | null
  position_raw: string | null
  linkedin_url: string | null
  normalized_title: string | null
  seniority_level: string | null
  department: string | null
  industry: string | null
  match_score: number
  source_employees: string[]
}

export interface SearchParams {
  job_title: string
  department?: string
  seniority?: string
  keywords?: string[]
}

// ─── Pass 3: enrich with source employees ────────────────────────────────────

async function enrichWithSources(results: CandidateMatch[]): Promise<CandidateMatch[]> {
  if (!results.length) return results

  const contactIds = results.map(r => r.contact_id)

  const { data: sources, error } = await supabase
    .from('contact_sources')
    .select('contact_id, employees(name)')
    .in('contact_id', contactIds)

  if (error) {
    console.warn('[searchService] source enrichment failed:', error.message)
    return results
  }

  const sourceMap = new Map<string, string[]>()
  for (const row of (sources ?? []) as any[]) {
    const cid  = row.contact_id as string
    const name = row.employees?.name as string | undefined
    if (!name) continue
    if (!sourceMap.has(cid)) sourceMap.set(cid, [])
    sourceMap.get(cid)!.push(name)
  }

  return results.map(r => ({
    ...r,
    source_employees: sourceMap.get(r.contact_id) ?? [],
  }))
}

// ─── Main search function ────────────────────────────────────────────────────

export async function searchCandidates(params: SearchParams): Promise<CandidateMatch[]> {
  const { data: dbResults, error } = await supabase.rpc('search_candidates', {
    search_title:      params.job_title,
    search_department: params.department ?? null,
    search_seniority:  params.seniority  ?? null,
    search_keywords:   params.keywords?.length ? params.keywords.join(' ') : null,
  })

  if (error) throw new Error(`searchCandidates RPC failed: ${error.message}`)

  const raw = (dbResults ?? []) as Array<Omit<CandidateMatch, 'source_employees'> & { match_score: number }>

  const boosted: CandidateMatch[] = raw.map(candidate => {
    let bonus = 0
    if (candidate.normalized_title) {
      bonus += fuzzyMatchTitle(params.job_title, candidate.normalized_title) * 20
    }
    if (candidate.position_raw) {
      bonus += fuzzyMatchTitle(params.job_title, candidate.position_raw) * 10
    }
    return {
      ...candidate,
      match_score:      candidate.match_score + bonus,
      source_employees: [],
    }
  })

  boosted.sort((a, b) => b.match_score - a.match_score)

  const top200 = boosted.slice(0, 200)
  return enrichWithSources(top200)
}

// ─── Auto-search on job creation ─────────────────────────────────────────────

export async function searchAndCreateJob(data: {
  job_title: string
  department?: string
  seniority?: string
  keywords?: string[]
  description?: string
}): Promise<{ job: Job; candidates: CandidateMatch[] }> {
  const [job, candidates] = await Promise.all([
    createJob(data),
    searchCandidates({
      job_title:  data.job_title,
      department: data.department,
      seniority:  data.seniority,
      keywords:   data.keywords,
    }),
  ])

  return { job, candidates }
}
