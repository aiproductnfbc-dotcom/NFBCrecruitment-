import { supabase } from './supabaseClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivitySubjectType = 'client' | 'contact' | 'job' | 'application'

export type ActivityType =
  | 'note' | 'call' | 'email_logged' | 'meeting' | 'task'
  | 'status_change' | 'stage_change' | 'created' | 'updated'

export interface ActivityProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface Activity {
  id: string
  subject_type: ActivitySubjectType
  subject_id: string
  activity_type: ActivityType
  title: string
  body: string | null
  occurred_at: string
  due_at: string | null
  completed_at: string | null
  is_pinned: boolean
  created_by: string | null
  assignee_id: string | null
  created_at: string
  updated_at: string
  creator?: ActivityProfile | null
  assignee?: ActivityProfile | null
}

export interface MyTask extends Activity {
  subject_label: string   // human-readable subject type
}

// ─── getActivities ────────────────────────────────────────────────────────────

export interface GetActivitiesOptions {
  activityType?: ActivityType
  limit?: number
  before?: string   // ISO timestamp cursor — returns activities older than this
}

export async function getActivities(
  subjectType: ActivitySubjectType,
  subjectId: string,
  options: GetActivitiesOptions = {}
): Promise<Activity[]> {
  const { activityType, limit = 50, before } = options

  let query = supabase
    .from('activities')
    .select(`
      *,
      creator:profiles!activities_created_by_fkey(id, full_name, avatar_url),
      assignee:profiles!activities_assignee_id_fkey(id, full_name, avatar_url)
    `)
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .order('is_pinned', { ascending: false })
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (activityType) query = query.eq('activity_type', activityType)
  if (before)       query = query.lt('occurred_at', before)

  const { data, error } = await query
  if (error) throw new Error(`getActivities failed: ${error.message}`)
  return (data ?? []) as Activity[]
}

// ─── createActivity ───────────────────────────────────────────────────────────

export async function createActivity(data: {
  subject_type: ActivitySubjectType
  subject_id: string
  activity_type: ActivityType
  title: string
  body?: string
  occurred_at?: string
  due_at?: string
  assignee_id?: string
  is_pinned?: boolean
}): Promise<Activity> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data: row, error } = await supabase
    .from('activities')
    .insert({
      ...data,
      body:        data.body        ?? null,
      due_at:      data.due_at      ?? null,
      assignee_id: data.assignee_id ?? null,
      is_pinned:   data.is_pinned   ?? false,
      occurred_at: data.occurred_at ?? new Date().toISOString(),
      created_by:  user?.id ?? null,
    })
    .select(`
      *,
      creator:profiles!activities_created_by_fkey(id, full_name, avatar_url),
      assignee:profiles!activities_assignee_id_fkey(id, full_name, avatar_url)
    `)
    .single()

  if (error) throw new Error(`createActivity failed: ${error.message}`)
  return row as Activity
}

// ─── updateActivity ───────────────────────────────────────────────────────────

export async function updateActivity(
  id: string,
  data: Partial<Pick<Activity, 'title' | 'body' | 'due_at' | 'completed_at' | 'is_pinned'>>
): Promise<Activity> {
  const { data: row, error } = await supabase
    .from('activities')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      creator:profiles!activities_created_by_fkey(id, full_name, avatar_url),
      assignee:profiles!activities_assignee_id_fkey(id, full_name, avatar_url)
    `)
    .single()

  if (error) throw new Error(`updateActivity failed: ${error.message}`)
  return row as Activity
}

// ─── deleteActivity ───────────────────────────────────────────────────────────

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`deleteActivity failed: ${error.message}`)
}

// ─── getMyTasks ───────────────────────────────────────────────────────────────

const SUBJECT_LABELS: Record<ActivitySubjectType, string> = {
  client:      'Client',
  contact:     'Contact',
  job:         'Job',
  application: 'Application',
}

export async function getMyTasks(userId: string): Promise<MyTask[]> {
  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      creator:profiles!activities_created_by_fkey(id, full_name, avatar_url),
      assignee:profiles!activities_assignee_id_fkey(id, full_name, avatar_url)
    `)
    .eq('activity_type', 'task')
    .eq('assignee_id', userId)
    .is('completed_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`getMyTasks failed: ${error.message}`)

  return ((data ?? []) as Activity[]).map(a => ({
    ...a,
    subject_label: SUBJECT_LABELS[a.subject_type],
  }))
}

// ─── completeTask ─────────────────────────────────────────────────────────────

export async function completeTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`completeTask failed: ${error.message}`)
}
