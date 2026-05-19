import { supabase } from './supabaseClient'

// ── Types ──────────────────────────────────────────────────────────────────────

export type InterviewType   = 'phone' | 'video' | 'onsite' | 'technical' | 'panel'
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'
export type ParticipantRole = 'interviewer' | 'observer' | 'coordinator'
export type FeedbackRec     = 'strong_yes' | 'yes' | 'no' | 'strong_no'

export interface InterviewParticipant {
  id: string
  interview_id: string
  user_id: string | null
  external_name: string | null
  external_email: string | null
  role: ParticipantRole
  user?: { id: string; full_name: string | null; email: string } | null
}

export interface InterviewFeedback {
  id: string
  interview_id: string
  participant_id: string | null
  overall_rating: number | null
  recommendation: FeedbackRec | null
  strengths: string | null
  concerns: string | null
  notes: string | null
  submitted_at: string
}

export interface Interview {
  id: string
  application_id: string
  round_number: number | null
  scheduled_at: string
  duration_minutes: number
  location: string | null
  meeting_url: string | null
  type: InterviewType
  status: InterviewStatus
  created_by: string | null
  created_at: string
  updated_at: string
  participants?: InterviewParticipant[]
  feedback?: InterviewFeedback[]
}

export interface InterviewWithContext extends Interview {
  application?: {
    id: string
    contact: { first_name: string; last_name: string } | null
    job: { id: string; job_title: string } | null
  } | null
}

// ── Schedule ───────────────────────────────────────────────────────────────────

export async function scheduleInterview(
  applicationId: string,
  data: {
    round_number?: number
    scheduled_at: string
    duration_minutes?: number
    location?: string
    meeting_url?: string
    type: InterviewType
  },
  participants?: {
    user_id?: string
    external_name?: string
    external_email?: string
    role: ParticipantRole
  }[]
): Promise<Interview> {
  const { data: interview, error } = await supabase
    .from('interviews')
    .insert({
      application_id:   applicationId,
      round_number:     data.round_number     ?? null,
      scheduled_at:     data.scheduled_at,
      duration_minutes: data.duration_minutes ?? 60,
      location:         data.location         ?? null,
      meeting_url:      data.meeting_url       ?? null,
      type:             data.type,
    })
    .select()
    .single()

  if (error) throw new Error(`scheduleInterview failed: ${error.message}`)

  if (participants?.length) {
    const rows = participants.map(p => ({
      interview_id:   (interview as Interview).id,
      user_id:        p.user_id       ?? null,
      external_name:  p.external_name  ?? null,
      external_email: p.external_email ?? null,
      role:           p.role,
    }))
    const { error: pErr } = await supabase.from('interview_participants').insert(rows)
    if (pErr) throw new Error(`scheduleInterview participants: ${pErr.message}`)
  }

  return interview as Interview
}

// ── Status update ──────────────────────────────────────────────────────────────

export async function updateInterviewStatus(
  id: string,
  status: InterviewStatus
): Promise<Interview> {
  const { data, error } = await supabase
    .from('interviews')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateInterviewStatus failed: ${error.message}`)
  return data as Interview
}

// ── Fetch for application ──────────────────────────────────────────────────────

export async function getInterviewsForApplication(applicationId: string): Promise<Interview[]> {
  const { data, error } = await supabase
    .from('interviews')
    .select(`
      *,
      participants:interview_participants(
        *, user:user_id(id, full_name, email)
      ),
      feedback:interview_feedback(*)
    `)
    .eq('application_id', applicationId)
    .order('scheduled_at', { ascending: true })

  if (error) throw new Error(`getInterviewsForApplication failed: ${error.message}`)
  return (data ?? []) as unknown as Interview[]
}

// ── Fetch for job (cross-application) ─────────────────────────────────────────

export async function getInterviewsForJob(jobId: string): Promise<InterviewWithContext[]> {
  const { data, error } = await supabase
    .from('interviews')
    .select(`
      *,
      participants:interview_participants(
        *, user:user_id(id, full_name, email)
      ),
      feedback:interview_feedback(*),
      application:application_id (
        id,
        contact:contact_id (first_name, last_name),
        job:job_id (id, job_title)
      )
    `)
    .order('scheduled_at', { ascending: true })

  if (error) throw new Error(`getInterviewsForJob fetch failed: ${error.message}`)

  // Filter by job_id via the joined application
  return ((data ?? []) as unknown as InterviewWithContext[]).filter(
    i => (i.application?.job as any)?.id === jobId
  )
}

// ── Upcoming interviews (dashboard) ───────────────────────────────────────────

export async function getUpcomingInterviews(days = 7): Promise<InterviewWithContext[]> {
  const from = new Date().toISOString()
  const to   = new Date(Date.now() + days * 86_400_000).toISOString()

  const { data, error } = await supabase
    .from('interviews')
    .select(`
      *,
      application:application_id (
        id,
        contact:contact_id (first_name, last_name),
        job:job_id (id, job_title)
      )
    `)
    .eq('status', 'scheduled')
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true })
    .limit(20)

  if (error) throw new Error(`getUpcomingInterviews failed: ${error.message}`)
  return (data ?? []) as unknown as InterviewWithContext[]
}

// ── Feedback ───────────────────────────────────────────────────────────────────

export async function submitFeedback(
  interviewId: string,
  participantId: string | null,
  data: {
    overall_rating?: number | null
    recommendation?: FeedbackRec | null
    strengths?: string | null
    concerns?: string | null
    notes?: string | null
  }
): Promise<InterviewFeedback> {
  const { data: row, error } = await supabase
    .from('interview_feedback')
    .insert({
      interview_id:   interviewId,
      participant_id: participantId,
      overall_rating: data.overall_rating ?? null,
      recommendation: data.recommendation ?? null,
      strengths:      data.strengths      ?? null,
      concerns:       data.concerns       ?? null,
      notes:          data.notes          ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`submitFeedback failed: ${error.message}`)
  return row as InterviewFeedback
}

export async function getFeedbackForInterview(interviewId: string): Promise<InterviewFeedback[]> {
  const { data, error } = await supabase
    .from('interview_feedback')
    .select()
    .eq('interview_id', interviewId)
    .order('submitted_at', { ascending: true })

  if (error) throw new Error(`getFeedbackForInterview failed: ${error.message}`)
  return (data ?? []) as InterviewFeedback[]
}

// ── ICS generation ─────────────────────────────────────────────────────────────

function toICSDate(d: Date): string {
  // Format: YYYYMMDDTHHmmssZ
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function foldICSLine(line: string): string {
  // RFC 5545: lines longer than 75 octets should be folded
  if (line.length <= 75) return line
  const chunks: string[] = []
  chunks.push(line.slice(0, 75))
  let offset = 75
  while (offset < line.length) {
    chunks.push(' ' + line.slice(offset, offset + 74))
    offset += 74
  }
  return chunks.join('\r\n')
}

export function generateICS(interview: Interview, summary?: string): string {
  const start    = new Date(interview.scheduled_at)
  const end      = new Date(start.getTime() + interview.duration_minutes * 60_000)
  const now      = new Date()
  const roundStr = interview.round_number ? ` Round ${interview.round_number}` : ''
  const title    = summary ?? `Interview${roundStr}`

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//New Frontiers Talent//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${interview.id}@recruitment-db`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${title}`,
  ]

  if (interview.location) lines.push(`LOCATION:${interview.location}`)
  if (interview.meeting_url) lines.push(`URL:${interview.meeting_url}`)

  lines.push(
    `STATUS:${interview.status === 'scheduled' ? 'CONFIRMED' : interview.status.toUpperCase()}`,
    'END:VEVENT',
    'END:VCALENDAR',
  )

  return lines.map(foldICSLine).join('\r\n')
}

export function downloadICS(interview: Interview, summary?: string): void {
  const content = generateICS(interview, summary)
  const blob    = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  a.href        = url
  a.download    = `interview-${interview.id}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
