import {
  detectSeniority,
  detectDepartment,
  normalizeTitle,
  categorizeTitle,
  categorizeTitleWithRules,
  fuzzyMatchTitle,
  findSimilarTitles,
  applyCustomRule,
  type TitleMappingRule,
} from "./categorize";

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function expectGte(label: string, actual: number, min: number) {
  if (actual >= min) {
    console.log(`  ✓ ${label} (score=${actual.toFixed(3)} >= ${min})`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected score >= ${min}, got ${actual.toFixed(3)}`);
    failed++;
  }
}

function expectLte(label: string, actual: number, max: number) {
  if (actual <= max) {
    console.log(`  ✓ ${label} (score=${actual.toFixed(3)} <= ${max})`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected score <= ${max}, got ${actual.toFixed(3)}`);
    failed++;
  }
}

// ─── Seniority Tests (Batch 5) ────────────────────────────────────────────────

console.log("\n── Seniority ────────────────────────────────────────────────────");

expect("Senior Software Engineer", detectSeniority("Senior Software Engineer"), "Senior");
expect("Software Engineer II", detectSeniority("Software Engineer II"), "Mid");
expect("Software Engineer III", detectSeniority("Software Engineer III"), "Senior");
expect("Software Engineer I", detectSeniority("Software Engineer I"), "Junior");
expect("VP of Engineering", detectSeniority("VP of Engineering"), "VP");
expect("Chief Technology Officer", detectSeniority("Chief Technology Officer"), "C-Suite");
expect("Engineering Manager", detectSeniority("Engineering Manager"), "Manager");
expect("Junior Data Analyst", detectSeniority("Junior Data Analyst"), "Junior");
expect("Lead Designer", detectSeniority("Lead Designer"), "Lead");
expect("Intern", detectSeniority("Intern"), "Intern");
expect("Associate Director of Sales", detectSeniority("Associate Director of Sales"), "Director");
expect("Co-Founder & CEO", detectSeniority("Co-Founder & CEO"), "C-Suite");
expect("Principal Engineer", detectSeniority("Principal Engineer"), "Lead");
expect("Staff Software Engineer", detectSeniority("Staff Software Engineer"), "Lead");
expect("Senior Manager, Marketing", detectSeniority("Senior Manager, Marketing"), "Manager");
expect("empty string → null", detectSeniority(""), null);
expect("CTO", detectSeniority("CTO"), "C-Suite");
expect("Associate Vice President", detectSeniority("Associate Vice President"), "VP");
expect("Managing Director", detectSeniority("Managing Director"), "Director");
expect("Sales Associate", detectSeniority("Sales Associate"), "Junior");
expect("Graduate Trainee", detectSeniority("Graduate Trainee"), "Intern");
expect("Software Engineer (no seniority) → Mid", detectSeniority("Software Engineer"), "Mid");
expect("SVP of Sales", detectSeniority("SVP of Sales"), "VP");
expect("Head of Product", detectSeniority("Head of Product"), "Director");

// ─── Department Tests (Batch 5) ───────────────────────────────────────────────

console.log("\n── Department ───────────────────────────────────────────────────");

expect("Senior Software Engineer", detectDepartment("Senior Software Engineer"), "Engineering");
expect("Data Scientist", detectDepartment("Data Scientist"), "Data");
expect("Product Manager", detectDepartment("Product Manager"), "Product");
expect("UX Designer", detectDepartment("UX Designer"), "Design");
expect("Marketing Manager", detectDepartment("Marketing Manager"), "Marketing");
expect("Account Executive", detectDepartment("Account Executive"), "Sales");
expect("Financial Analyst", detectDepartment("Financial Analyst"), "Finance");
expect("HR Business Partner", detectDepartment("HR Business Partner"), "HR");
expect("Supply Chain Manager", detectDepartment("Supply Chain Manager"), "Operations");
expect("General Counsel", detectDepartment("General Counsel"), "Legal");
expect("Management Consultant", detectDepartment("Management Consultant"), "Consulting");
expect("Registered Nurse", detectDepartment("Registered Nurse"), "Healthcare");
expect("Assistant Professor", detectDepartment("Assistant Professor"), "Education");
expect("Sales Engineer", detectDepartment("Sales Engineer"), "Sales");
expect("Data Engineer", detectDepartment("Data Engineer"), "Data");
expect("Customer Success Manager", detectDepartment("Customer Success Manager"), "Sales");
expect("Product Designer", detectDepartment("Product Designer"), "Design");
expect("Marketing Engineer", detectDepartment("Marketing Engineer"), "Marketing");
expect("DevOps Engineer", detectDepartment("DevOps Engineer"), "Engineering");
expect("Machine Learning Engineer", detectDepartment("Machine Learning Engineer"), "Data");
expect("Business Development Manager", detectDepartment("Business Development Manager"), "Sales");
expect("Chief Financial Officer", detectDepartment("Chief Financial Officer"), "Finance");
expect("Unknown Role", detectDepartment("Unknown Role"), "Other");
expect("empty string → Other", detectDepartment(""), "Other");

// ─── Normalization Tests (Batch 6) ────────────────────────────────────────────

console.log("\n── Normalization ────────────────────────────────────────────────");

expect("Sr. Software Dev", normalizeTitle("Sr. Software Dev"), "Software Developer");
expect("SWE", normalizeTitle("SWE"), "Software Engineer");
expect("Jr. Data Analyst", normalizeTitle("Jr. Data Analyst"), "Data Analyst");
expect("SDE II", normalizeTitle("SDE II"), "Software Development Engineer");
expect("HRBP", normalizeTitle("HRBP"), "HR Business Partner");
expect("Lead SRE", normalizeTitle("Lead SRE"), "Site Reliability Engineer");
expect("VP of Mktg", normalizeTitle("VP of Mktg"), "VP of Marketing");
expect("SDR", normalizeTitle("SDR"), "Sales Development Representative");
expect("FP&A Manager", normalizeTitle("FP&A Manager"), "Financial Planning & Analysis Manager");
expect("QA Eng.", normalizeTitle("QA Eng."), "Quality Assurance Engineer");
expect("empty string", normalizeTitle(""), "");
expect("--- (non-word chars)", normalizeTitle("---"), "");

// ─── Fuzzy Matching Tests (Batch 6) ──────────────────────────────────────────

console.log("\n── Fuzzy Matching ───────────────────────────────────────────────");

expectGte(
  "Software Engineer vs Software Developer (min 0.5)",
  fuzzyMatchTitle("Software Engineer", "Software Developer"),
  0.5
);
expectGte(
  "Software Engineer vs Senior SWE (min 0.4)",
  fuzzyMatchTitle("Software Engineer", "Senior SWE"),
  0.4
);
expectGte(
  "Data Analyst vs Data Analytics (min 0.5)",
  fuzzyMatchTitle("Data Analyst", "Data Analytics"),
  0.5
);
expectGte(
  "Accountant vs Senior Accountant (min 0.6)",
  fuzzyMatchTitle("Accountant", "Senior Accountant"),
  0.6
);
expectLte(
  "Marketing vs Nurse (max 0.2)",
  fuzzyMatchTitle("Marketing", "Nurse"),
  0.2
);

// findSimilarTitles sanity check
const titles = ["Software Developer", "Data Scientist", "Marketing Manager", "Senior SWE"];
const similar = findSimilarTitles("Software Engineer", titles, 0.4);
expect(
  "findSimilarTitles returns results above threshold",
  similar.length > 0,
  true
);
expect(
  "findSimilarTitles results are sorted descending",
  similar.every((r: {title: string; score: number}, i: number) => i === 0 || r.score <= similar[i - 1]!.score),
  true
);

// ─── Custom Rules Tests (Batch 6) ────────────────────────────────────────────

console.log("\n── Custom Rules ─────────────────────────────────────────────────");

const rules: TitleMappingRule[] = [
  {
    pattern: "Relationship Manager",
    normalized_title: null,
    seniority_level: null,
    department: "Sales",
    priority: 10,
  },
  {
    pattern: "Scrum Master",
    normalized_title: "Scrum Master",
    seniority_level: null,
    department: "Engineering",
    priority: 10,
  },
];

const relResult = applyCustomRule("Relationship Manager", rules);
expect(
  "Relationship Manager rule → department Sales",
  relResult?.department ?? null,
  "Sales"
);

const scrumResult = applyCustomRule("Scrum Master", rules);
expect(
  "Scrum Master rule → department Engineering",
  scrumResult?.department ?? null,
  "Engineering"
);
expect(
  "Scrum Master rule → normalized_title Scrum Master",
  scrumResult?.normalized_title ?? null,
  "Scrum Master"
);

// No match
const noMatch = applyCustomRule("Product Manager", rules);
expect("No matching rule → null", noMatch, null);

// ─── Full Categorization Tests (Batch 6) ──────────────────────────────────────

console.log("\n── Full Categorization ──────────────────────────────────────────");

const r1 = categorizeTitle("Sr. Software Dev");
expect("Sr. Software Dev → normalized", r1.normalized_title, "Software Developer");
expect("Sr. Software Dev → seniority", r1.seniority_level, "Senior");
expect("Sr. Software Dev → department", r1.department, "Engineering");

const r2 = categorizeTitle("Junior Marketing Associate");
expect("Junior Marketing Associate → normalized", r2.normalized_title, "Marketing Associate");
expect("Junior Marketing Associate → seniority", r2.seniority_level, "Junior");
expect("Junior Marketing Associate → department", r2.department, "Marketing");

const r3 = categorizeTitle("Chief Financial Officer");
expect("Chief Financial Officer → normalized", r3.normalized_title, "Chief Financial Officer");
expect("Chief Financial Officer → seniority", r3.seniority_level, "C-Suite");
expect("Chief Financial Officer → department", r3.department, "Finance");

// categorizeTitleWithRules applies custom rule override
const customRules: TitleMappingRule[] = [
  { pattern: "Scrum Master", normalized_title: "Scrum Master", seniority_level: null, department: "Engineering", priority: 10 },
];
const r4 = categorizeTitleWithRules("Scrum Master", customRules);
expect("Scrum Master with rule → department", r4.department, "Engineering");
expect("Scrum Master with rule → normalized_title", r4.normalized_title, "Scrum Master");

// Empty title
const r5 = categorizeTitle("");
expect("empty → seniority null", r5.seniority_level, null);
expect("empty → department Other", r5.department, "Other");
expect("empty → normalized empty", r5.normalized_title, "");

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ──────────────────────────────────────────────────────`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`─────────────────────────────────────────────────────────────────\n`);

if (failed > 0) process.exit(1);
