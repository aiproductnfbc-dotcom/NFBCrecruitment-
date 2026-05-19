import 'dotenv/config'
import { categorizeTitle } from './categorize'
import { processUpload } from './uploadProcessor'
import { getOrCreateEmployee } from './employeeManager'
import { supabase } from './supabaseClient'

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

function expectGte(label: string, actual: number, min: number) {
  if (actual >= min) {
    console.log(`  ✓ ${label} (${actual} >= ${min})`)
    passed++
  } else {
    console.error(`  ✗ ${label} — expected >= ${min}, got ${actual}`)
    failed++
  }
}

// ─── Test CSV ─────────────────────────────────────────────────────────────────

// Use highly unique names to avoid collisions with real data
const UNIQUE_SUFFIX = `_test_${Date.now()}`

const TEST_CSV = `First Name,Last Name,Email Address,Company,Position,Connected On,URL
TestFirst${UNIQUE_SUFFIX},TestLast${UNIQUE_SUFFIX},test1@batch7.test,TestCorp,Sr. Software Dev,15 Jan 2024,https://www.linkedin.com/in/test1batch7${UNIQUE_SUFFIX}
TestFirst2${UNIQUE_SUFFIX},TestLast2${UNIQUE_SUFFIX},test2@batch7.test,TestCorp,Junior Marketing Associate,01/15/2024,https://www.linkedin.com/in/test2batch7${UNIQUE_SUFFIX}
TestFirst3${UNIQUE_SUFFIX},TestLast3${UNIQUE_SUFFIX},,TestCorp,Chief Financial Officer,2024-01-15,https://www.linkedin.com/in/test3batch7${UNIQUE_SUFFIX}
`

// ─── Cleanup helper ───────────────────────────────────────────────────────────

async function cleanup(employeeId: string) {
  // Delete contact_sources for this employee (cascades nothing — must clean manually)
  const { data: sources } = await supabase
    .from('contact_sources')
    .select('contact_id')
    .eq('employee_id', employeeId)

  const contactIds = (sources ?? []).map((s: any) => s.contact_id as string)

  if (contactIds.length) {
    // categorized_positions cascade deletes when contact is deleted
    await supabase.from('contacts').delete().in('id', contactIds)
  }

  await supabase.from('upload_log').delete().eq('employee_id', employeeId)
  await supabase.from('employees').delete().eq('id', employeeId)
}

// ─── Unit: Categorization Integration ────────────────────────────────────────

console.log('\n── Categorization Integration (unit) ────────────────────────────')

const cat1 = categorizeTitle('Sr. Software Dev')
expect('"Sr. Software Dev" normalized_title', cat1.normalized_title, 'Software Developer')
expect('"Sr. Software Dev" seniority_level', cat1.seniority_level, 'Senior')
expect('"Sr. Software Dev" department', cat1.department, 'Engineering')

const cat2 = categorizeTitle('Junior Marketing Associate')
expect('"Junior Marketing Associate" normalized_title', cat2.normalized_title, 'Marketing Associate')
expect('"Junior Marketing Associate" seniority_level', cat2.seniority_level, 'Junior')
expect('"Junior Marketing Associate" department', cat2.department, 'Marketing')

const cat3 = categorizeTitle('Chief Financial Officer')
expect('"Chief Financial Officer" normalized_title', cat3.normalized_title, 'Chief Financial Officer')
expect('"Chief Financial Officer" seniority_level', cat3.seniority_level, 'C-Suite')
expect('"Chief Financial Officer" department', cat3.department, 'Finance')

// ─── Integration: Full Pipeline + Dedup ──────────────────────────────────────

console.log('\n── Pipeline Integration (Supabase) ──────────────────────────────')

async function runIntegrationTests() {
  const EMPLOYEE_NAME = `BatchTest_Employee${UNIQUE_SUFFIX}`

  let employeeId: string | null = null

  try {
    // Create test employee
    const employee = await getOrCreateEmployee(EMPLOYEE_NAME, 'batchtest@test.com')
    employeeId = employee.id
    console.log(`  [setup] Test employee created: ${employee.id}`)

    // ── First upload ────────────────────────────────────────────────────────
    console.log('\n  First upload:')
    const run1 = await processUpload(TEST_CSV, employeeId, 'test_upload_1.csv')

    expect('  run1 totalRows', run1.totalRows, 3)
    expect('  run1 newContacts', run1.newContacts, 3)
    expect('  run1 duplicates', run1.duplicates, 0)
    expect('  run1 categorized', run1.categorized, 3)
    expect('  run1 errors', run1.errors.length, 0)
    expectGte('  run1 newContactsList length', run1.newContactsList.length, 3)

    // Verify categorizations from the pipeline
    type Entry = typeof run1.newContactsList[0]
    const c1 = run1.newContactsList.find((c: Entry) => c.position === 'Sr. Software Dev')
    expect('  run1 "Sr. Software Dev" normalized_title', c1?.normalized_title, 'Software Developer')
    expect('  run1 "Sr. Software Dev" seniority', c1?.seniority, 'Senior')
    expect('  run1 "Sr. Software Dev" department', c1?.department, 'Engineering')

    const c2 = run1.newContactsList.find((c: Entry) => c.position === 'Junior Marketing Associate')
    expect('  run1 "Junior Marketing Associate" department', c2?.department, 'Marketing')

    const c3 = run1.newContactsList.find((c: Entry) => c.position === 'Chief Financial Officer')
    expect('  run1 "Chief Financial Officer" seniority', c3?.seniority, 'C-Suite')
    expect('  run1 "Chief Financial Officer" department', c3?.department, 'Finance')

    // ── Second upload (same CSV, same employee) → all duplicates ───────────
    console.log('\n  Second upload (dedup test):')
    const run2 = await processUpload(TEST_CSV, employeeId, 'test_upload_2.csv')

    expect('  run2 totalRows', run2.totalRows, 3)
    expect('  run2 newContacts = 0', run2.newContacts, 0)
    expect('  run2 duplicates = 3', run2.duplicates, 3)
    expect('  run2 categorized = 0', run2.categorized, 0)

    // ── Verify upload_log entries ───────────────────────────────────────────
    console.log('\n  Upload log check:')
    const { data: logs } = await supabase
      .from('upload_log')
      .select('*')
      .eq('employee_id', employeeId)
      .order('uploaded_at')

    expect('  upload_log has 2 entries', (logs ?? []).length, 2)
    expect('  log[0] new_contacts', (logs as any[])[0]?.new_contacts, 3)
    expect('  log[1] duplicates', (logs as any[])[1]?.duplicates, 3)

  } catch (err: any) {
    console.error(`  [error] Integration test failed: ${err.message}`)
    failed++
  } finally {
    // Cleanup
    if (employeeId) {
      await cleanup(employeeId)
      console.log('\n  [cleanup] Test data removed.')
    }
  }
}

runIntegrationTests().then(() => {
  console.log(`\n── Results ──────────────────────────────────────────────────────`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`─────────────────────────────────────────────────────────────────\n`)
  if (failed > 0) process.exit(1)
})
