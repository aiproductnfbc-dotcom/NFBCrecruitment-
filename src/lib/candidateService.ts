import { supabase } from './supabaseClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  company: string | null
  position_raw: string | null
  linkedin_url: string | null
  connected_on: string | null
  phone: string | null
  contact_type: 'lead' | 'candidate' | 'both'
  candidate_status: 'active' | 'do_not_contact' | 'placed' | 'blacklisted' | null
  current_title: string | null
  current_company: string | null
  candidate_location: string | null
  willing_to_relocate: boolean | null
  years_experience: number | null
  expected_salary: number | null
  salary_currency: string | null
  notice_period_days: number | null
  candidate_source: string | null
  candidate_source_detail: string | null
  owner_id: string | null
  gdpr_consent_at: string | null
  gdpr_expires_at: string | null
  created_at: string
  updated_at: string
  // joined
  categorized_positions?: {
    normalized_title: string | null
    seniority_level: string | null
    department: string | null
    industry: string | null
  } | null
  owner?: { id: string; full_name: string | null; email: string } | null
}

export interface ContactResume {
  id: string
  contact_id: string
  file_url: string
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  parsed_text: string | null
  is_primary: boolean
  uploaded_by: string | null
  created_at: string
}

export interface Skill {
  id: string
  name: string
  category: string | null
  created_at: string
}

export interface ContactSkill {
  contact_id: string
  skill_id: string
  years: number | null
  proficiency: number | null
  skill?: Skill
}

export interface ContactExperience {
  id: string
  contact_id: string
  company: string | null
  title: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
  location: string | null
  created_at: string
  updated_at: string
}

export interface ContactEducation {
  id: string
  contact_id: string
  institution: string | null
  degree: string | null
  field: string | null
  start_year: number | null
  end_year: number | null
  created_at: string
  updated_at: string
}

export interface ContactApplication {
  id: string
  contact_id: string
  job_id: string
  stage_id: number
  status: string
  applied_at: string
  last_stage_change_at: string
  job?: { id: string; job_title: string; department: string | null } | null
  stage?: { name: string; slug: string } | null
}

// ─── Contact CRUD ─────────────────────────────────────────────────────────────

export async function getContact(id: string): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      categorized_positions (normalized_title, seniority_level, department, industry),
      owner:profiles!contacts_owner_id_fkey (id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(`getContact failed: ${error.message}`)
  return data as Contact
}

export async function updateContact(id: string, data: Partial<Contact>): Promise<Contact> {
  const { data: row, error } = await supabase
    .from('contacts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      categorized_positions (normalized_title, seniority_level, department, industry),
      owner:profiles!contacts_owner_id_fkey (id, full_name, email)
    `)
    .single()

  if (error) throw new Error(`updateContact failed: ${error.message}`)
  return row as Contact
}

export async function createContact(data: {
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  position_raw?: string | null
  linkedin_url?: string | null
  contact_type?: Contact['contact_type']
  current_title?: string | null
  current_company?: string | null
  candidate_source?: string | null
  owner_id?: string | null
}): Promise<Contact> {
  const { data: row, error } = await supabase
    .from('contacts')
    .insert({
      first_name:   data.first_name,
      last_name:    data.last_name,
      email:        data.email        ?? null,
      phone:        data.phone        ?? null,
      company:      data.company      ?? null,
      position_raw: data.position_raw ?? null,
      linkedin_url: data.linkedin_url ?? null,
      contact_type: data.contact_type ?? 'lead',
      current_title:   data.current_title   ?? null,
      current_company: data.current_company ?? null,
      candidate_source: data.candidate_source ?? null,
      owner_id:     data.owner_id     ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(`createContact failed: ${error.message}`)
  return row as Contact
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

export async function detectDuplicates(params: {
  email?: string | null
  first_name: string
  last_name: string
  phone?: string | null
}): Promise<Contact[]> {
  const results: Contact[] = []
  const seen = new Set<string>()

  // 1. Email match
  if (params.email?.trim()) {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, company, contact_type')
      .eq('email', params.email.trim())
      .limit(3)

    for (const c of (data ?? []) as Contact[]) {
      if (!seen.has(c.id)) { seen.add(c.id); results.push(c) }
    }
  }

  // 2. Name + phone match
  if (params.phone?.trim() && params.first_name && params.last_name) {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, company, contact_type')
      .ilike('first_name', params.first_name.trim())
      .ilike('last_name',  params.last_name.trim())
      .eq('phone', params.phone.trim())
      .limit(3)

    for (const c of (data ?? []) as Contact[]) {
      if (!seen.has(c.id)) { seen.add(c.id); results.push(c) }
    }
  }

  return results
}

// ─── Resumes ──────────────────────────────────────────────────────────────────

const RESUME_BUCKET = 'resumes'
const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10 MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

export async function getResumes(contactId: string): Promise<ContactResume[]> {
  const { data, error } = await supabase
    .from('contact_resumes')
    .select('*')
    .eq('contact_id', contactId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getResumes failed: ${error.message}`)
  return (data ?? []) as ContactResume[]
}

export async function uploadResume(contactId: string, file: File): Promise<ContactResume> {
  if (file.size > MAX_FILE_SIZE) throw new Error('File exceeds 10 MB limit')
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Only PDF and DOCX files are accepted')

  const { data: { user } } = await supabase.auth.getUser()

  // Sanitise filename and build storage path
  const ext  = file.name.split('.').pop() ?? 'bin'
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const path = `${contactId}/${Date.now()}_${safe}`

  const { error: uploadError } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) throw new Error(`Resume upload failed: ${uploadError.message}`)

  // Check if this is the first resume — make it primary automatically
  const { count } = await supabase
    .from('contact_resumes')
    .select('*', { count: 'exact', head: true })
    .eq('contact_id', contactId)

  const isPrimary = (count ?? 0) === 0

  const { data: row, error: metaError } = await supabase
    .from('contact_resumes')
    .insert({
      contact_id:  contactId,
      file_url:    path,
      file_name:   file.name,
      mime_type:   file.type,
      file_size:   file.size,
      is_primary:  isPrimary,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single()

  if (metaError) {
    // Clean up uploaded file if metadata insert fails
    await supabase.storage.from(RESUME_BUCKET).remove([path])
    throw new Error(`Resume metadata failed: ${metaError.message}`)
  }

  return row as ContactResume
}

export async function getResumeSignedUrl(resume: ContactResume): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(resume.file_url, 3600)  // 1 hour

  if (error) throw new Error(`Failed to create signed URL: ${error.message}`)
  return data.signedUrl
}

export async function setPrimaryResume(contactId: string, resumeId: string): Promise<void> {
  await supabase
    .from('contact_resumes')
    .update({ is_primary: false })
    .eq('contact_id', contactId)

  await supabase
    .from('contact_resumes')
    .update({ is_primary: true })
    .eq('id', resumeId)
}

export async function deleteResume(resume: ContactResume): Promise<void> {
  // Delete storage object first
  await supabase.storage.from(RESUME_BUCKET).remove([resume.file_url])

  const { error } = await supabase
    .from('contact_resumes')
    .delete()
    .eq('id', resume.id)

  if (error) throw new Error(`deleteResume failed: ${error.message}`)
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export async function searchSkills(term: string): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .ilike('name', `%${term.trim()}%`)
    .order('name')
    .limit(10)

  if (error) throw new Error(`searchSkills failed: ${error.message}`)
  return (data ?? []) as Skill[]
}

export async function getContactSkills(contactId: string): Promise<ContactSkill[]> {
  const { data, error } = await supabase
    .from('contact_skills')
    .select('*, skill:skills(*)')
    .eq('contact_id', contactId)

  if (error) throw new Error(`getContactSkills failed: ${error.message}`)
  return (data ?? []) as ContactSkill[]
}

export async function ensureSkill(name: string, category?: string): Promise<Skill> {
  const trimmed = name.trim()

  const { data, error } = await supabase
    .from('skills')
    .insert({ name: trimmed, category: category ?? null })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      // Unique violation — fetch the existing skill (case-insensitive)
      const { data: existing, error: fetchErr } = await supabase
        .from('skills')
        .select('*')
        .ilike('name', trimmed)
        .single()
      if (fetchErr) throw new Error(`ensureSkill failed: ${fetchErr.message}`)
      return existing as Skill
    }
    throw new Error(`ensureSkill failed: ${error.message}`)
  }

  return data as Skill
}

export async function addContactSkill(
  contactId: string,
  skillId: string,
  years?: number | null,
  proficiency?: number | null
): Promise<ContactSkill> {
  const { data, error } = await supabase
    .from('contact_skills')
    .insert({ contact_id: contactId, skill_id: skillId, years: years ?? null, proficiency: proficiency ?? null })
    .select('*, skill:skills(*)')
    .single()

  if (error) throw new Error(`addContactSkill failed: ${error.message}`)
  return data as ContactSkill
}

export async function updateContactSkill(
  contactId: string,
  skillId: string,
  data: { years?: number | null; proficiency?: number | null }
): Promise<ContactSkill> {
  const { data: row, error } = await supabase
    .from('contact_skills')
    .update(data)
    .eq('contact_id', contactId)
    .eq('skill_id', skillId)
    .select('*, skill:skills(*)')
    .single()

  if (error) throw new Error(`updateContactSkill failed: ${error.message}`)
  return row as ContactSkill
}

export async function removeContactSkill(contactId: string, skillId: string): Promise<void> {
  const { error } = await supabase
    .from('contact_skills')
    .delete()
    .eq('contact_id', contactId)
    .eq('skill_id', skillId)

  if (error) throw new Error(`removeContactSkill failed: ${error.message}`)
}

// ─── Experiences ──────────────────────────────────────────────────────────────

export async function getExperiences(contactId: string): Promise<ContactExperience[]> {
  const { data, error } = await supabase
    .from('contact_experiences')
    .select('*')
    .eq('contact_id', contactId)
    .order('is_current', { ascending: false })
    .order('start_date', { ascending: false, nullsFirst: false })

  if (error) throw new Error(`getExperiences failed: ${error.message}`)
  return (data ?? []) as ContactExperience[]
}

export async function createExperience(
  data: Omit<ContactExperience, 'id' | 'created_at' | 'updated_at'>
): Promise<ContactExperience> {
  const { data: row, error } = await supabase
    .from('contact_experiences')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`createExperience failed: ${error.message}`)
  return row as ContactExperience
}

export async function updateExperience(
  id: string,
  data: Partial<Omit<ContactExperience, 'id' | 'contact_id' | 'created_at' | 'updated_at'>>
): Promise<ContactExperience> {
  const { data: row, error } = await supabase
    .from('contact_experiences')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateExperience failed: ${error.message}`)
  return row as ContactExperience
}

export async function deleteExperience(id: string): Promise<void> {
  const { error } = await supabase.from('contact_experiences').delete().eq('id', id)
  if (error) throw new Error(`deleteExperience failed: ${error.message}`)
}

// ─── Education ────────────────────────────────────────────────────────────────

export async function getEducation(contactId: string): Promise<ContactEducation[]> {
  const { data, error } = await supabase
    .from('contact_education')
    .select('*')
    .eq('contact_id', contactId)
    .order('end_year', { ascending: false, nullsFirst: false })

  if (error) throw new Error(`getEducation failed: ${error.message}`)
  return (data ?? []) as ContactEducation[]
}

export async function createEducation(
  data: Omit<ContactEducation, 'id' | 'created_at' | 'updated_at'>
): Promise<ContactEducation> {
  const { data: row, error } = await supabase
    .from('contact_education')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`createEducation failed: ${error.message}`)
  return row as ContactEducation
}

export async function updateEducation(
  id: string,
  data: Partial<Omit<ContactEducation, 'id' | 'contact_id' | 'created_at' | 'updated_at'>>
): Promise<ContactEducation> {
  const { data: row, error } = await supabase
    .from('contact_education')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateEducation failed: ${error.message}`)
  return row as ContactEducation
}

export async function deleteEducation(id: string): Promise<void> {
  const { error } = await supabase.from('contact_education').delete().eq('id', id)
  if (error) throw new Error(`deleteEducation failed: ${error.message}`)
}

// ─── Applications for contact ─────────────────────────────────────────────────

export async function getContactApplications(contactId: string): Promise<ContactApplication[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, contact_id, job_id, stage_id, status, applied_at, last_stage_change_at,
      job:jobs(id, job_title, department),
      stage:pipeline_stages(name, slug)
    `)
    .eq('contact_id', contactId)
    .order('applied_at', { ascending: false })

  if (error) throw new Error(`getContactApplications failed: ${error.message}`)
  return (data ?? []) as unknown as ContactApplication[]
}

// ─── GDPR ─────────────────────────────────────────────────────────────────────

export async function exportContactData(contactId: string): Promise<object> {
  const [
    contactRes,
    resumesRes,
    skillsRes,
    experiencesRes,
    educationRes,
    applicationsRes,
    activitiesRes,
  ] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', contactId).single(),
    supabase.from('contact_resumes').select('id, file_name, mime_type, file_size, is_primary, created_at').eq('contact_id', contactId),
    supabase.from('contact_skills').select('*, skill:skills(name, category)').eq('contact_id', contactId),
    supabase.from('contact_experiences').select('*').eq('contact_id', contactId),
    supabase.from('contact_education').select('*').eq('contact_id', contactId),
    supabase.from('applications').select('*, job:jobs(job_title), stage:pipeline_stages(name)').eq('contact_id', contactId),
    supabase.from('activities').select('activity_type, title, body, occurred_at').eq('subject_type', 'contact').eq('subject_id', contactId),
  ])

  return {
    exported_at:  new Date().toISOString(),
    contact:      contactRes.data,
    resumes:      resumesRes.data ?? [],
    skills:       skillsRes.data  ?? [],
    experiences:  experiencesRes.data ?? [],
    education:    educationRes.data   ?? [],
    applications: applicationsRes.data ?? [],
    activities:   activitiesRes.data  ?? [],
  }
}

export async function hardDeleteContact(contactId: string): Promise<void> {
  // Must delete in order: polymorphic records first (no FK cascade),
  // then applications (ON DELETE RESTRICT), then contact (CASCADE handles the rest).

  await supabase.from('activities')
    .delete()
    .eq('subject_type', 'contact')
    .eq('subject_id', contactId)

  await supabase.from('entity_tags')
    .delete()
    .eq('entity_type', 'contact')
    .eq('entity_id', contactId)

  const { error: appErr } = await supabase
    .from('applications')
    .delete()
    .eq('contact_id', contactId)
  if (appErr) throw new Error(`hardDeleteContact: failed to delete applications: ${appErr.message}`)

  // Delete resume files from storage before deleting metadata rows
  const { data: resumes } = await supabase
    .from('contact_resumes')
    .select('file_url')
    .eq('contact_id', contactId)

  if (resumes?.length) {
    await supabase.storage
      .from('resumes')
      .remove(resumes.map(r => r.file_url))
  }

  const { error } = await supabase.from('contacts').delete().eq('id', contactId)
  if (error) throw new Error(`hardDeleteContact failed: ${error.message}`)
}
