import { parseLinkedInCSV, parseConnectedOn } from './csvParser'

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function expect<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    console.error(`      expected: ${JSON.stringify(expected)}`)
    console.error(`      actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

function expectTruthy(label: string, actual: unknown) {
  if (actual) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label} — got: ${JSON.stringify(actual)}`)
    failed++
  }
}

// ─── Sample CSV ───────────────────────────────────────────────────────────────

const SAMPLE_CSV = `First Name,Last Name,Email Address,Company,Position,Connected On,URL
John,Doe,john@example.com,Google,Senior Software Engineer,15 Jan 2024,https://www.linkedin.com/in/johndoe
Jane,Smith,,Microsoft,Product Manager,01/15/2024,https://www.linkedin.com/in/janesmith
Bob,Wilson,bob@test.com,Amazon,,2024-01-15,
,,,,,,
`

// ─── Basic parsing ────────────────────────────────────────────────────────────

console.log('\n── CSV Parsing ──────────────────────────────────────────────────')

const contacts = parseLinkedInCSV(SAMPLE_CSV)

expect('parses 3 valid contacts (empty row skipped)', contacts.length, 3)

expect('row 1 firstName', contacts[0].firstName, 'John')
expect('row 1 lastName',  contacts[0].lastName,  'Doe')
expect('row 1 email',     contacts[0].email,     'john@example.com')
expect('row 1 company',   contacts[0].company,   'Google')
expect('row 1 position',  contacts[0].position,  'Senior Software Engineer')
expect('row 1 linkedinUrl', contacts[0].linkedinUrl, 'https://www.linkedin.com/in/johndoe')

expect('row 2 email is null (empty field)', contacts[1].email, null)
expect('row 2 company', contacts[1].company, 'Microsoft')

expect('row 3 position is null (empty field)', contacts[2].position, null)
expect('row 3 linkedinUrl is null (empty field)', contacts[2].linkedinUrl, null)

// ─── Date parsing ─────────────────────────────────────────────────────────────

console.log('\n── Date Parsing ─────────────────────────────────────────────────')

// "15 Jan 2024"
const d1 = parseConnectedOn('15 Jan 2024')
expectTruthy('"15 Jan 2024" parses to a Date', d1 instanceof Date)
expect('"15 Jan 2024" → year 2024', d1?.getFullYear(), 2024)
expect('"15 Jan 2024" → month 0 (Jan)', d1?.getMonth(), 0)
expect('"15 Jan 2024" → day 15', d1?.getDate(), 15)

// "01/15/2024"
const d2 = parseConnectedOn('01/15/2024')
expectTruthy('"01/15/2024" parses to a Date', d2 instanceof Date)
expect('"01/15/2024" → year 2024', d2?.getFullYear(), 2024)
expect('"01/15/2024" → month 0', d2?.getMonth(), 0)
expect('"01/15/2024" → day 15', d2?.getDate(), 15)

// "2024-01-15"
const d3 = parseConnectedOn('2024-01-15')
expectTruthy('"2024-01-15" parses to a Date', d3 instanceof Date)
expect('"2024-01-15" → year 2024', d3?.getFullYear(), 2024)
expect('"2024-01-15" → month 0', d3?.getMonth(), 0)
expect('"2024-01-15" → day 15', d3?.getDate(), 15)

// Row 1 date (15 Jan 2024)
expectTruthy('row 1 connectedOn is Date', contacts[0].connectedOn instanceof Date)
// Row 2 date (01/15/2024)
expectTruthy('row 2 connectedOn is Date', contacts[1].connectedOn instanceof Date)
// Row 3 date (2024-01-15)
expectTruthy('row 3 connectedOn is Date', contacts[2].connectedOn instanceof Date)

expect('null date → null', parseConnectedOn(null), null)
expect('empty date → null', parseConnectedOn(''), null)

// ─── BOM handling ─────────────────────────────────────────────────────────────

console.log('\n── BOM Handling ─────────────────────────────────────────────────')

const CSV_WITH_BOM = '\uFEFF' + SAMPLE_CSV
const bomContacts = parseLinkedInCSV(CSV_WITH_BOM)
expect('BOM stripped — still parses 3 contacts', bomContacts.length, 3)
expect('BOM stripped — first row firstName correct', bomContacts[0].firstName, 'John')

// ─── Flexible column headers ──────────────────────────────────────────────────

console.log('\n── Flexible Column Headers ──────────────────────────────────────')

const ALT_CSV = `FirstName,LastName,Email,Organization,Title,Date Connected,Profile URL
Alice,Jones,alice@corp.com,Meta,Engineering Manager,15 Jan 2024,https://www.linkedin.com/in/alicejones
`
const altContacts = parseLinkedInCSV(ALT_CSV)
expect('alt headers — 1 contact parsed', altContacts.length, 1)
expect('alt headers — firstName', altContacts[0].firstName, 'Alice')
expect('alt headers — company (Organization)', altContacts[0].company, 'Meta')
expect('alt headers — position (Title)', altContacts[0].position, 'Engineering Manager')
expect('alt headers — linkedinUrl (Profile URL)', altContacts[0].linkedinUrl, 'https://www.linkedin.com/in/alicejones')

// ─── Edge cases ───────────────────────────────────────────────────────────────

console.log('\n── Edge Cases ───────────────────────────────────────────────────')

const EMPTY_CSV = `First Name,Last Name,Email Address,Company,Position,Connected On,URL
,,,,,,
,,,,,,
`
const emptyResult = parseLinkedInCSV(EMPTY_CSV)
expect('all-empty rows → 0 contacts', emptyResult.length, 0)

const NO_ROWS = 'First Name,Last Name\n'
const noRows = parseLinkedInCSV(NO_ROWS)
expect('header only → 0 contacts', noRows.length, 0)

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ──────────────────────────────────────────────────────`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`─────────────────────────────────────────────────────────────────\n`)

if (failed > 0) process.exit(1)
