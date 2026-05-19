import { supabase } from './supabaseClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TagEntityType = 'client' | 'contact' | 'job'

export interface Tag {
  id: string
  name: string
  color: string
  entity_type: TagEntityType
  created_at: string
}

export interface EntityTag {
  tag_id: string
  entity_type: TagEntityType
  entity_id: string
  tagged_at: string
  tagged_by: string | null
  tag?: Tag
}

// ─── Tag CRUD ─────────────────────────────────────────────────────────────────

export async function listTags(entityType: TagEntityType): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('entity_type', entityType)
    .order('name')

  if (error) throw new Error(`listTags failed: ${error.message}`)
  return (data ?? []) as Tag[]
}

export async function createTag(
  name: string,
  color: string,
  entityType: TagEntityType
): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ name: name.trim(), color, entity_type: entityType })
    .select()
    .single()

  if (error) throw new Error(`createTag failed: ${error.message}`)
  return data as Tag
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw new Error(`deleteTag failed: ${error.message}`)
}

// ─── Entity tag assignment ────────────────────────────────────────────────────

export async function getTags(
  entityType: TagEntityType,
  entityId: string
): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('entity_tags')
    .select('tag:tags(*)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)

  if (error) throw new Error(`getTags failed: ${error.message}`)
  return (data ?? []).map((r: any) => r.tag) as Tag[]
}

export async function addTag(
  entityType: TagEntityType,
  entityId: string,
  tagId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('entity_tags')
    .insert({ tag_id: tagId, entity_type: entityType, entity_id: entityId, tagged_by: user?.id ?? null })

  if (error && !error.message.includes('duplicate')) {
    throw new Error(`addTag failed: ${error.message}`)
  }
}

export async function removeTag(
  entityType: TagEntityType,
  entityId: string,
  tagId: string
): Promise<void> {
  const { error } = await supabase
    .from('entity_tags')
    .delete()
    .eq('tag_id', tagId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)

  if (error) throw new Error(`removeTag failed: ${error.message}`)
}
