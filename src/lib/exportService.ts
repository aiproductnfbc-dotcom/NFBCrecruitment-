import type { ShortlistEntry } from './shortlistService'
import type { CandidateMatch } from './searchService'

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Escape quotes and wrap in quotes if the value contains comma, quote, or newline
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',')
}

// ─── Shortlist export ─────────────────────────────────────────────────────────

const SHORTLIST_HEADERS = [
  'First Name', 'Last Name', 'Email', 'Company',
  'Position (Raw)', 'Normalized Title', 'Seniority', 'Department',
  'LinkedIn URL', 'Match Score', 'Status', 'Notes',
]

export function exportShortlistToCSV(entries: ShortlistEntry[]): string {
  const rows = [csvRow(SHORTLIST_HEADERS)]

  for (const e of entries) {
    rows.push(csvRow([
      e.contact?.first_name         ?? '',
      e.contact?.last_name          ?? '',
      e.contact?.email              ?? '',
      e.contact?.company            ?? '',
      e.contact?.position_raw       ?? '',
      e.categorization?.normalized_title ?? '',
      e.categorization?.seniority_level  ?? '',
      e.categorization?.department       ?? '',
      e.contact?.linkedin_url       ?? '',
      e.match_score.toFixed(2),
      e.status,
      e.notes ?? '',
    ]))
  }

  return rows.join('\r\n')
}

// ─── Search results export ────────────────────────────────────────────────────

const SEARCH_HEADERS = [
  'First Name', 'Last Name', 'Email', 'Company',
  'Position (Raw)', 'Normalized Title', 'Seniority', 'Department',
  'LinkedIn URL', 'Match Score', 'Source Employees',
]

export function exportSearchResultsToCSV(candidates: CandidateMatch[]): string {
  const rows = [csvRow(SEARCH_HEADERS)]

  for (const c of candidates) {
    rows.push(csvRow([
      c.first_name       ?? '',
      c.last_name        ?? '',
      c.email            ?? '',
      c.company          ?? '',
      c.position_raw     ?? '',
      c.normalized_title ?? '',
      c.seniority_level  ?? '',
      c.department       ?? '',
      c.linkedin_url     ?? '',
      c.match_score.toFixed(2),
      (c.source_employees ?? []).join('; '),
    ]))
  }

  return rows.join('\r\n')
}

// ─── Contacts page export ─────────────────────────────────────────────────────

const CONTACT_HEADERS = [
  'First Name', 'Last Name', 'Email', 'Phone', 'Company',
  'Position (Raw)', 'Normalized Title', 'Seniority', 'Department',
  'LinkedIn URL', 'Type', 'Status',
]

export function exportContactsToCSV(contacts: Array<{
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  position_raw?: string | null
  categorized_positions?: {
    normalized_title?: string | null
    seniority_level?: string | null
    department?: string | null
  } | null
  linkedin_url?: string | null
  contact_type?: string | null
  candidate_status?: string | null
}>): string {
  const rows = [csvRow(CONTACT_HEADERS)]
  for (const c of contacts) {
    const cat = c.categorized_positions
    rows.push(csvRow([
      c.first_name        ?? '',
      c.last_name         ?? '',
      c.email             ?? '',
      c.phone             ?? '',
      c.company           ?? '',
      c.position_raw      ?? '',
      cat?.normalized_title ?? '',
      cat?.seniority_level  ?? '',
      cat?.department       ?? '',
      c.linkedin_url      ?? '',
      c.contact_type      ?? '',
      c.candidate_status  ?? '',
    ]))
  }
  return rows.join('\r\n')
}

// ─── Browser download (runs in browser only) ──────────────────────────────────

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
