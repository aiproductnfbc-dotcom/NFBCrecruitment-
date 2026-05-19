import { supabase } from './supabaseClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'overdue_task' | 'upcoming_interview' | 'feedback_needed'

export interface NotificationItem {
  id:         string
  type:       NotificationType
  title:      string
  subtitle:   string
  link:       string
  timestamp:  string    // ISO — used for sorting
}

// ─── getNotificationItems ─────────────────────────────────────────────────────

const SUBJECT_LINK: Record<string, (id: string) => string> = {
  contact:     id => `/app/contacts/${id}`,
  client:      id => `/app/clients/${id}`,
  job:         id => `/app/jobs/${id}`,
  application: _  => '/app/dashboard',
}

export async function getNotificationItems(userId: string): Promise<NotificationItem[]> {
  const now      = new Date()
  const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [tasksRes, interviewsRes, completedRes] = await Promise.all([
    // Overdue tasks assigned to me
    supabase
      .from('activities')
      .select('id, title, subject_type, subject_id, due_at')
      .eq('activity_type', 'task')
      .eq('assignee_id', userId)
      .is('completed_at', null)
      .not('due_at', 'is', null)
      .lt('due_at', now.toISOString())
      .order('due_at', { ascending: true })
      .limit(15),

    // Interviews scheduled in the next 24 h
    supabase
      .from('interviews')
      .select(`
        id, scheduled_at, type, duration_minutes,
        application:application_id(
          contact:contact_id(first_name, last_name),
          job:job_id(id, job_title)
        )
      `)
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', in24h.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10),

    // Interviews completed in the last 7 days with no feedback
    supabase
      .from('interviews')
      .select(`
        id, scheduled_at, type,
        feedback:interview_feedback(id),
        application:application_id(
          contact:contact_id(first_name, last_name),
          job:job_id(id, job_title)
        )
      `)
      .eq('status', 'completed')
      .gte('scheduled_at', new Date(now.getTime() - 7 * 86_400_000).toISOString())
      .order('scheduled_at', { ascending: false })
      .limit(10),
  ])

  const items: NotificationItem[] = []

  // Overdue tasks
  for (const t of (tasksRes.data ?? [])) {
    items.push({
      id:        `task-${t.id}`,
      type:      'overdue_task',
      title:     t.title,
      subtitle:  `Overdue · due ${new Date(t.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      link:      (SUBJECT_LINK[t.subject_type] ?? (() => '/'))(t.subject_id),
      timestamp: t.due_at,
    })
  }

  // Upcoming interviews
  for (const iv of (interviewsRes.data ?? [])) {
    const contact = (iv.application as any)?.contact
    const job     = (iv.application as any)?.job
    const when    = new Date(iv.scheduled_at)
    const isToday = when.toDateString() === now.toDateString()

    items.push({
      id:       `interview-${iv.id}`,
      type:     'upcoming_interview',
      title:    contact
        ? `${iv.type.charAt(0).toUpperCase() + iv.type.slice(1)} interview with ${contact.first_name} ${contact.last_name}`
        : `${iv.type} interview`,
      subtitle: [
        job?.job_title ?? '',
        isToday
          ? `Today at ${when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
          : `Tomorrow at ${when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      ].filter(Boolean).join(' · '),
      link:      job?.id ? `/app/jobs/${job.id}` : '/app/dashboard',
      timestamp: iv.scheduled_at,
    })
  }

  // Completed interviews without feedback
  for (const iv of (completedRes.data ?? [])) {
    const feedback = (iv.feedback as any[]) ?? []
    if (feedback.length > 0) continue   // already has feedback

    const contact = (iv.application as any)?.contact
    const job     = (iv.application as any)?.job

    items.push({
      id:       `feedback-${iv.id}`,
      type:     'feedback_needed',
      title:    contact
        ? `Add feedback for ${contact.first_name} ${contact.last_name}`
        : 'Interview feedback needed',
      subtitle: job?.job_title
        ? `${job.job_title} · ${iv.type} interview`
        : `${iv.type} interview`,
      link:     job?.id ? `/app/jobs/${job.id}` : '/app/dashboard',
      timestamp: iv.scheduled_at,
    })
  }

  // Sort: overdue tasks first, then by timestamp
  const ORDER: Record<NotificationType, number> = {
    overdue_task:       0,
    feedback_needed:    1,
    upcoming_interview: 2,
  }

  return items.sort((a, b) => {
    const typeDiff = ORDER[a.type] - ORDER[b.type]
    if (typeDiff !== 0) return typeDiff
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  })
}
