import { supabase } from './supabaseClient'
import { categorizeTitleWithRules, type TitleMappingRule } from './categorize'

const BATCH_SIZE = 100

export interface RecategorizeResult {
  total: number
  updated: number
  errors: number
}

export async function bulkRecategorize(): Promise<RecategorizeResult> {
  const result: RecategorizeResult = { total: 0, updated: 0, errors: 0 }

  // 1. Fetch all custom rules
  const { data: rulesData, error: rulesErr } = await supabase
    .from('title_mapping_rules')
    .select('pattern, normalized_title, seniority_level, department, priority')
    .order('priority', { ascending: false })

  if (rulesErr) throw new Error(`bulkRecategorize — failed to load rules: ${rulesErr.message}`)
  const rules = (rulesData ?? []) as TitleMappingRule[]

  // 2. Count total contacts
  const { count } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })

  const total = count ?? 0
  result.total = total

  // 3. Process in batches
  for (let offset = 0; offset < total; offset += BATCH_SIZE) {
    const { data: contacts, error: contactsErr } = await supabase
      .from('contacts')
      .select(`
        id, position_raw,
        categorized_positions (
          id, normalized_title, seniority_level, department, is_manual_override
        )
      `)
      .range(offset, offset + BATCH_SIZE - 1)

    if (contactsErr) {
      console.warn(`[bulkRecategorize] Batch at offset ${offset} failed: ${contactsErr.message}`)
      result.errors++
      continue
    }

    for (const contact of contacts as any[]) {
      try {
        const cat = contact.categorized_positions
        // Skip contacts with manual overrides
        if (cat?.is_manual_override) continue

        const newCat = categorizeTitleWithRules(contact.position_raw ?? '', rules)

        const changed =
          !cat ||
          cat.normalized_title !== (newCat.normalized_title || null) ||
          cat.seniority_level  !== newCat.seniority_level ||
          cat.department       !== newCat.department

        if (!changed) continue

        if (cat?.id) {
          // Update existing row
          const { error } = await supabase
            .from('categorized_positions')
            .update({
              normalized_title: newCat.normalized_title || null,
              seniority_level:  newCat.seniority_level,
              department:       newCat.department,
              updated_at:       new Date().toISOString(),
            })
            .eq('id', cat.id)

          if (error) throw error
        } else {
          // Insert missing categorization row
          const { error } = await supabase
            .from('categorized_positions')
            .insert({
              contact_id:       contact.id,
              normalized_title: newCat.normalized_title || null,
              seniority_level:  newCat.seniority_level,
              department:       newCat.department,
            })

          if (error) throw error
        }

        result.updated++
      } catch (err: any) {
        console.warn(`[bulkRecategorize] Contact ${contact.id} failed: ${err?.message}`)
        result.errors++
      }
    }
  }

  return result
}
