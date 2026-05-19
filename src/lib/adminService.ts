import { supabase } from './supabaseClient'
import { invalidateStageCache } from './pipelineService'

// ── User management ───────────────────────────────────────────────────────────

export interface UserWithRoles {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  roles: { slug: string; name: string }[]
}

export async function listUsersWithRoles(): Promise<UserWithRoles[]> {
  // Two flat queries merged client-side to avoid PostgREST ambiguity
  // with deeply-nested embedded joins (profiles → user_roles → roles).
  const [profilesRes, userRolesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, is_active, created_at')
      .order('created_at'),
    supabase
      .from('user_roles')
      .select('user_id, roles(slug, name)'),
  ])

  if (profilesRes.error) throw new Error(`listUsersWithRoles: ${profilesRes.error.message}`)
  if (userRolesRes.error) throw new Error(`listUsersWithRoles: ${userRolesRes.error.message}`)

  // Build a map of userId → roles[]
  const rolesByUser = new Map<string, { slug: string; name: string }[]>()
  for (const row of (userRolesRes.data ?? [])) {
    const ur = row as unknown as {
      user_id: string
      roles: { slug: string; name: string } | { slug: string; name: string }[] | null
    }
    if (!ur.roles) continue
    // PostgREST may return roles as a single object or an array depending on the schema cache
    const roleEntry = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles
    if (!roleEntry) continue
    if (!rolesByUser.has(ur.user_id)) rolesByUser.set(ur.user_id, [])
    rolesByUser.get(ur.user_id)!.push(roleEntry)
  }

  return (profilesRes.data ?? []).map(p => ({
    id:         p.id as string,
    email:      p.email as string,
    full_name:  p.full_name as string | null,
    avatar_url: p.avatar_url as string | null,
    is_active:  p.is_active as boolean,
    created_at: p.created_at as string,
    roles:      rolesByUser.get(p.id as string) ?? [],
  }))
}

export async function assignRole(userId: string, roleSlug: string): Promise<void> {
  const { data: roleRow, error: roleErr } = await supabase
    .from('roles')
    .select('id')
    .eq('slug', roleSlug)
    .single()
  if (roleErr) throw new Error(`Role not found: ${roleSlug}`)

  const actorId = (await supabase.auth.getUser()).data.user?.id
  const { error } = await supabase.from('user_roles').insert({
    user_id:    userId,
    role_id:    roleRow.id,
    granted_by: actorId ?? null,
  })
  if (error && error.code !== '23505') {
    throw new Error(`assignRole failed: ${error.message}`)
  }
}

export async function removeRole(userId: string, roleSlug: string): Promise<void> {
  const { data: roleRow, error: roleErr } = await supabase
    .from('roles')
    .select('id')
    .eq('slug', roleSlug)
    .single()
  if (roleErr) throw new Error(`Role not found: ${roleSlug}`)

  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleRow.id)
  if (error) throw new Error(`removeRole failed: ${error.message}`)
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
  if (error) throw new Error(`setUserActive failed: ${error.message}`)
}

// ── Audit logs ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id:          string
  actor_id:    string | null
  action:      string
  entity_type: string
  entity_id:   string | null
  before_json: Record<string, unknown> | null
  after_json:  Record<string, unknown> | null
  created_at:  string
  actor?:      { full_name: string | null; email: string } | null
}

export interface AuditFilters {
  actorId?:    string
  entityType?: string
  action?:     string
  from?:       string
  to?:         string
}

export async function listAuditLogs(
  filters: AuditFilters = {},
  limit = 100
): Promise<AuditLog[]> {
  let q = supabase
    .from('audit_logs')
    .select(`
      id, actor_id, action, entity_type, entity_id,
      before_json, after_json, created_at,
      actor:profiles!actor_id(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters.actorId)    q = q.eq('actor_id', filters.actorId)
  if (filters.entityType) q = q.eq('entity_type', filters.entityType)
  if (filters.action)     q = q.eq('action', filters.action)
  if (filters.from)       q = q.gte('created_at', filters.from)
  if (filters.to)         q = q.lte('created_at', filters.to)

  const { data, error } = await q
  if (error) throw new Error(`listAuditLogs failed: ${error.message}`)
  return (data ?? []) as unknown as AuditLog[]
}

// ── Pipeline stage management ─────────────────────────────────────────────────

export interface PipelineStageAdmin {
  id:          number
  name:        string
  slug:        string
  order_index: number
  stage_type:  string
  is_active:   boolean
}

export async function listPipelineStagesAdmin(): Promise<PipelineStageAdmin[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id, name, slug, order_index, stage_type, is_active')
    .order('order_index')
  if (error) throw new Error(`listPipelineStagesAdmin failed: ${error.message}`)
  return (data ?? []) as PipelineStageAdmin[]
}

export async function updateStageOrder(
  stages: { id: number; order_index: number }[]
): Promise<void> {
  // Upsert new order_index for each stage
  const updates = stages.map(s =>
    supabase
      .from('pipeline_stages')
      .update({ order_index: s.order_index })
      .eq('id', s.id)
  )
  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) throw new Error(`updateStageOrder failed: ${failed.error.message}`)
}

export async function addPipelineStage(
  name: string,
  stageType: string
): Promise<PipelineStageAdmin> {
  // Place at end
  const { data: existing } = await supabase
    .from('pipeline_stages')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const nextIndex = ((existing as { order_index: number } | null)?.order_index ?? 0) + 1
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({ name, slug: `${slug}_${nextIndex}`, order_index: nextIndex, stage_type: stageType })
    .select()
    .single()
  if (error) throw new Error(`addPipelineStage failed: ${error.message}`)
  invalidateStageCache()
  return data as PipelineStageAdmin
}

export async function toggleStageActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('pipeline_stages')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(`toggleStageActive failed: ${error.message}`)
  invalidateStageCache()
}
