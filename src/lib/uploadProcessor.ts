import { supabase } from './supabaseClient'
import { parseLinkedInCSV } from './csvParser'
import { categorizeTitleWithRules, type TitleMappingRule } from './categorize'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UploadResult {
  totalRows:       number
  newContacts:     number
  duplicates:      number
  categorized:     number
  errors:          string[]
  durationMs:      number
  newContactsList: Array<{
    name:             string
    company:          string | null
    position:         string | null
    normalized_title: string
    seniority:        string | null
    department:       string
  }>
}

export type ProgressCallback = (processed: number, total: number) => void

// ── Constants ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 200   // rows per DB call
const NAME_FETCH_CHUNK = 400   // names per IN() query

// ── Helpers ────────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Strip characters outside the Unicode Basic Multilingual Plane.
 * These serialize to JSON surrogate pairs (e.g. \uD835\uDC68) that
 * PostgREST's Aeson parser rejects with "unsupported Unicode escape sequence".
 * Affects: emoji, mathematical bold/italic letters, rare CJK extensions, etc.
 */
function sanitize(s: string | null | undefined): string | null {
  if (s == null) return null
  const cleaned = s.replace(/[\uD800-\uDFFF]/g, '').trim()
  return cleaned || null
}

// ── Custom rules (one query, cached for this run) ──────────────────────────────

async function fetchCustomRules(): Promise<TitleMappingRule[]> {
  const { data, error } = await supabase
    .from('title_mapping_rules')
    .select('pattern, normalized_title, seniority_level, department, priority')
    .order('priority', { ascending: false })

  if (error) {
    console.warn('[uploadProcessor] Could not load custom rules:', error.message)
    return []
  }
  return (data ?? []) as TitleMappingRule[]
}

// ── Dedup pre-fetch: by LinkedIn URL ──────────────────────────────────────────
// Returns Map<linkedin_url, contact_id>

async function fetchExistingByUrl(urls: string[]): Promise<Map<string, string>> {
  if (!urls.length) return new Map()
  const { data, error } = await supabase
    .from('contacts')
    .select('id, linkedin_url')
    .in('linkedin_url', urls)
  if (error) {
    console.warn('[uploadProcessor] URL dedup fetch failed:', error.message)
    return new Map()
  }
  return new Map((data ?? []).map((r: any) => [r.linkedin_url as string, r.id as string]))
}

// ── Dedup pre-fetch: by first+last name ──────────────────────────────────────
// Fetches only rows whose first_name appears in the upload batch.
// Returns Map<"lower_first|lower_last", contact_id>

async function fetchExistingByName(firstNames: string[]): Promise<Map<string, string>> {
  if (!firstNames.length) return new Map()
  const map = new Map<string, string>()
  // Chunk to stay within URL length limits
  for (const chunk of chunkArray(firstNames, NAME_FETCH_CHUNK)) {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .in('first_name', chunk)
    if (error) {
      console.warn('[uploadProcessor] Name dedup fetch failed:', error.message)
      continue
    }
    for (const row of (data ?? []) as any[]) {
      const key = `${String(row.first_name).toLowerCase()}|${String(row.last_name).toLowerCase()}`
      if (!map.has(key)) map.set(key, row.id as string)
    }
  }
  return map
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function processUpload(
  csvContent: string,
  employeeId: string,
  filename = 'upload.csv',
  onProgress?: ProgressCallback
): Promise<UploadResult> {
  const startMs = Date.now()

  const result: UploadResult = {
    totalRows:       0,
    newContacts:     0,
    duplicates:      0,
    categorized:     0,
    errors:          [],
    durationMs:      0,
    newContactsList: [],
  }

  // ── Phase 1: Parse ──────────────────────────────────────────────────────────
  const contacts = parseLinkedInCSV(csvContent)
  result.totalRows = contacts.length
  if (!contacts.length) return result

  // ── Phase 2: Categorize all in memory (CPU only, zero DB calls) ─────────────
  const customRules = await fetchCustomRules()   // 1 DB query
  type Prepared = {
    contact: typeof contacts[0]
    cat: ReturnType<typeof categorizeTitleWithRules>
  }
  const prepared: Prepared[] = contacts.map(c => ({
    contact: c,
    cat:     categorizeTitleWithRules(c.position ?? '', customRules),
  }))

  // ── Phase 3: Bulk dedup pre-fetch (2 DB queries total) ──────────────────────
  const allUrls    = contacts.map(c => c.linkedinUrl).filter((u): u is string => !!u)
  const allFirstNames = [...new Set(contacts.map(c => c.firstName))]

  const [existingByUrl, existingByName] = await Promise.all([
    fetchExistingByUrl(allUrls),
    fetchExistingByName(allFirstNames),
  ])

  // ── Phase 4: Client-side split ───────────────────────────────────────────────
  // toInsert: contacts not yet in the DB
  // dupIds:   IDs of existing contacts (need contact_source attribution)
  const toInsert: Prepared[]  = []
  const dupIds:   string[]    = []
  const seenUrl  = new Set<string>()  // within-file URL dedup
  const seenName = new Set<string>()  // within-file name dedup

  for (const item of prepared) {
    const { contact } = item

    // 1. URL match against DB
    if (contact.linkedinUrl && existingByUrl.has(contact.linkedinUrl)) {
      dupIds.push(existingByUrl.get(contact.linkedinUrl)!)
      continue
    }
    // 2. URL duplicate within this file
    if (contact.linkedinUrl && seenUrl.has(contact.linkedinUrl)) {
      continue
    }

    // 3. Name match against DB (first+last)
    const nameKey = `${contact.firstName.toLowerCase()}|${contact.lastName.toLowerCase()}`
    if (existingByName.has(nameKey)) {
      const existingId = existingByName.get(nameKey)
      if (existingId) dupIds.push(existingId)
      continue
    }
    // 4. Name duplicate within this file
    if (seenName.has(nameKey)) {
      continue
    }

    // → New contact
    if (contact.linkedinUrl) seenUrl.add(contact.linkedinUrl)
    seenName.add(nameKey)
    toInsert.push(item)
  }

  result.duplicates = result.totalRows - toInsert.length

  // ── Phase 5: Batch insert new contacts ──────────────────────────────────────
  // Each chunk = 1 contact insert + 1 contact_source insert + 1 cat_position insert
  // Total DB calls: ceil(N/200) × 3  (e.g., 33 calls for 2092 rows vs ~6300 before)

  // Build lookup maps for post-insert cat matching
  const catByUrl  = new Map<string, Prepared['cat']>()
  const catByName = new Map<string, Prepared['cat']>()
  for (const { contact, cat } of toInsert) {
    if (contact.linkedinUrl) catByUrl.set(contact.linkedinUrl, cat)
    const nk = `${contact.firstName.toLowerCase()}|${contact.lastName.toLowerCase()}`
    catByName.set(nk, cat)
  }

  let batchesProcessed = 0
  const chunks = chunkArray(toInsert, BATCH_SIZE)

  for (const chunk of chunks) {
    const contactRows = chunk.map(({ contact }) => ({
      first_name:   sanitize(contact.firstName) ?? contact.firstName,
      last_name:    sanitize(contact.lastName) ?? contact.lastName,
      email:        sanitize(contact.email),
      company:      sanitize(contact.company),
      position_raw: sanitize(contact.position),
      linkedin_url: contact.linkedinUrl,   // URLs won't have surrogates
      connected_on: contact.connectedOn?.toISOString().split('T')[0] ?? null,
    }))

    // Use upsert with ignoreDuplicates as a safety net against race conditions.
    // onConflict: 'linkedin_url' — only fires when linkedin_url is non-null
    // and a matching row already exists. Rows with null linkedin_url are always
    // inserted (nulls are not equal in unique indexes).
    const { data: inserted, error: insertErr } = await supabase
      .from('contacts')
      .upsert(contactRows, { onConflict: 'linkedin_url', ignoreDuplicates: true })
      .select('id, linkedin_url, first_name, last_name')

    if (insertErr) {
      result.errors.push(`Batch insert failed (chunk ${batchesProcessed + 1}): ${insertErr.message}`)
      batchesProcessed++
      onProgress?.(Math.min(batchesProcessed * BATCH_SIZE, toInsert.length), toInsert.length)
      continue
    }

    if (inserted && inserted.length > 0) {
      // ── contact_sources for new contacts ────────────────────────────────────
      await supabase.from('contact_sources').upsert(
        inserted.map((r: any) => ({ contact_id: r.id, employee_id: employeeId })),
        { onConflict: 'contact_id,employee_id', ignoreDuplicates: true }
      )

      // ── categorized_positions ───────────────────────────────────────────────
      const catRows = inserted.map((r: any) => {
        const cat = (r.linkedin_url && catByUrl.get(r.linkedin_url as string))
          || catByName.get(`${String(r.first_name).toLowerCase()}|${String(r.last_name).toLowerCase()}`)
          || { normalized_title: '', seniority_level: null, department: 'Unknown' }
        return {
          contact_id:       r.id,
          normalized_title: cat.normalized_title || null,
          seniority_level:  cat.seniority_level,
          department:       cat.department,
        }
      })
      await supabase.from('categorized_positions').insert(catRows)

      // ── Build result list ───────────────────────────────────────────────────
      for (const r of inserted as any[]) {
        const orig = chunk.find(item =>
          (r.linkedin_url && item.contact.linkedinUrl === r.linkedin_url) ||
          (!r.linkedin_url && item.contact.firstName === r.first_name && item.contact.lastName === r.last_name)
        )
        if (orig) {
          result.newContactsList.push({
            name:             `${orig.contact.firstName} ${orig.contact.lastName}`,
            company:          orig.contact.company,
            position:         orig.contact.position,
            normalized_title: orig.cat.normalized_title,
            seniority:        orig.cat.seniority_level,
            department:       orig.cat.department,
          })
        }
      }

      result.newContacts  += inserted.length
      result.categorized  += inserted.length
    }

    batchesProcessed++
    onProgress?.(Math.min(batchesProcessed * BATCH_SIZE, toInsert.length), toInsert.length)
  }

  // ── Phase 6: Batch attribute duplicates to this employee ────────────────────
  // One upsert call per 200 duplicates instead of one per row
  const uniqueDupIds = [...new Set(dupIds)]
  for (const chunk of chunkArray(uniqueDupIds, BATCH_SIZE)) {
    await supabase.from('contact_sources').upsert(
      chunk.map(id => ({ contact_id: id, employee_id: employeeId })),
      { onConflict: 'contact_id,employee_id', ignoreDuplicates: true }
    )
  }

  // ── Phase 7: Log upload ──────────────────────────────────────────────────────
  result.durationMs = Date.now() - startMs
  await supabase.from('upload_log').insert({
    employee_id:  employeeId,
    filename,
    total_rows:   result.totalRows,
    new_contacts: result.newContacts,
    duplicates:   result.duplicates,
    categorized:  result.categorized,
  })

  return result
}
