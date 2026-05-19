import Papa from 'papaparse'

export interface LinkedInContact {
  firstName: string
  lastName: string
  email: string | null
  company: string | null
  position: string | null
  connectedOn: Date | null
  linkedinUrl: string | null
}

// ─── Column name aliases ──────────────────────────────────────────────────────

const FIRST_NAME_COLS  = ['first name', 'firstname']
const LAST_NAME_COLS   = ['last name', 'lastname']
const EMAIL_COLS       = ['email address', 'email', 'e-mail', 'e-mail address']
const COMPANY_COLS     = ['company', 'organization']
const POSITION_COLS    = ['position', 'title', 'job title']
const CONNECTED_COLS   = ['connected on', 'connectedon', 'date connected']
const URL_COLS         = ['url', 'profile url', 'linkedin url', 'profile']

function findCol(headers: string[], aliases: string[]): string | undefined {
  return headers.find(h => aliases.includes(h.trim().toLowerCase()))
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

export function parseConnectedOn(raw: string | null | undefined): Date | null {
  if (!raw || raw.trim() === '') return null
  const s = raw.trim()

  // ISO: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
  }

  // "15 Jan 2024"
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (dmy) {
    const month = MONTH_MAP[dmy[2].toLowerCase()]
    if (month !== undefined) {
      const d = new Date(Number(dmy[3]), month, Number(dmy[1]))
      return isNaN(d.getTime()) ? null : d
    }
  }

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    const d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]))
    return isNaN(d.getTime()) ? null : d
  }

  // Fallback
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export function parseLinkedInCSV(csvContent: string): LinkedInContact[] {
  // Strip BOM if present
  let content = csvContent.replace(/^\uFEFF/, '')

  // LinkedIn exports include a preamble before the real CSV headers, e.g.:
  // "Notes: To protect our members' privacy..."
  // Skip all lines until we find the header row (contains "First Name" or "URL")
  const HEADER_SIGNALS = ['first name', 'firstname', 'url', 'first_name']
  const lines = content.split(/\r?\n/)
  const headerIdx = lines.findIndex(line =>
    HEADER_SIGNALS.some(sig => line.toLowerCase().includes(sig))
  )
  if (headerIdx > 0) {
    content = lines.slice(headerIdx).join('\n')
  }

  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  })

  const headers = result.meta.fields ?? []

  const firstNameCol  = findCol(headers, FIRST_NAME_COLS)
  const lastNameCol   = findCol(headers, LAST_NAME_COLS)
  const emailCol      = findCol(headers, EMAIL_COLS)
  const companyCol    = findCol(headers, COMPANY_COLS)
  const positionCol   = findCol(headers, POSITION_COLS)
  const connectedCol  = findCol(headers, CONNECTED_COLS)
  const urlCol        = findCol(headers, URL_COLS)

  const contacts: LinkedInContact[] = []

  for (const row of result.data) {
    const firstName = str(firstNameCol ? row[firstNameCol] : null) ?? ''
    const lastName  = str(lastNameCol  ? row[lastNameCol]  : null) ?? ''

    // Skip rows with no name at all
    if (!firstName && !lastName) continue

    contacts.push({
      firstName,
      lastName,
      email:       str(emailCol      ? row[emailCol]      : null),
      company:     str(companyCol    ? row[companyCol]    : null),
      position:    str(positionCol   ? row[positionCol]   : null),
      connectedOn: parseConnectedOn(connectedCol ? row[connectedCol] : null),
      linkedinUrl: str(urlCol        ? row[urlCol]        : null),
    })
  }

  return contacts
}
