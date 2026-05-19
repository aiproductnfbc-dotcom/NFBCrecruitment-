#!/usr/bin/env bash
# ============================================================================
# test-apply-flow.sh — curl harness for the submit-public-application edge fn
#
# Prerequisites:
#   1. HCAPTCHA_SECRET must be set in Supabase secrets
#      (test value: 0x0000000000000000000000000000000000000000)
#   2. At least one published, open job must exist in the DB
#   3. scripts/fixtures/sample-cv.pdf must exist
#
# Usage:  bash scripts/test-apply-flow.sh
# ============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_REF="lnoxybvenuxnrejqmhll"
BASE_URL="https://${PROJECT_REF}.supabase.co"
FN_URL="${BASE_URL}/functions/v1/submit-public-application"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxub3h5YnZlbnV4bnJlanFtaGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDgxMjIsImV4cCI6MjA5MTgyNDEyMn0.f0Ltlt6dWOh08k8nhstXYKGelNCnR4I4E5IraOU5hDA"

# Service role key from env (for cleanup). Set before running:
#   export SUPABASE_SERVICE_ROLE_KEY=...
SRK="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [ -z "$SRK" ]; then
  echo "ERROR: Set SUPABASE_SERVICE_ROLE_KEY env var for cleanup."
  echo "  export SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>"
  exit 1
fi

JOB_SLUG="finance-manager-6d5878"
TEST_EMAIL="test-apply-$(date +%s)@example.com"
CV_FILE="scripts/fixtures/sample-cv.pdf"
CAPTCHA_TOKEN="10000000-aaaa-bbbb-cccc-000000000001"
TEST_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
CV_PATH="applications/${TEST_UUID}.pdf"

PASS=0
FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name (expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

# ── Cleanup function ─────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "── Cleanup ──────────────────────────────────────────────────────"

  # Delete test contacts, applications, stage history, activities, rate limits
  # Using service-role REST API
  local auth="Authorization: Bearer $SRK"
  local api="apikey: $SRK"
  local ct="Content-Type: application/json"

  # Find test contact IDs
  local contacts=$(curl -s "${BASE_URL}/rest/v1/contacts?email=like.*test-apply*&select=id" \
    -H "$auth" -H "$api")

  if [ "$contacts" != "[]" ] && [ -n "$contacts" ]; then
    # Get contact IDs
    local contact_ids=$(echo "$contacts" | python3 -c "import sys,json; [print(c['id']) for c in json.load(sys.stdin)]" 2>/dev/null)

    for cid in $contact_ids; do
      # Delete applications (and cascade to stage_history via FK)
      local apps=$(curl -s "${BASE_URL}/rest/v1/applications?contact_id=eq.${cid}&select=id" \
        -H "$auth" -H "$api")
      local app_ids=$(echo "$apps" | python3 -c "import sys,json; [print(a['id']) for a in json.load(sys.stdin)]" 2>/dev/null)

      for aid in $app_ids; do
        # Delete stage history
        curl -s -X DELETE "${BASE_URL}/rest/v1/application_stage_history?application_id=eq.${aid}" \
          -H "$auth" -H "$api" > /dev/null
        # Delete activities
        curl -s -X DELETE "${BASE_URL}/rest/v1/activities?subject_id=eq.${aid}" \
          -H "$auth" -H "$api" > /dev/null
      done

      # Delete applications
      curl -s -X DELETE "${BASE_URL}/rest/v1/applications?contact_id=eq.${cid}" \
        -H "$auth" -H "$api" > /dev/null
      # Delete contact
      curl -s -X DELETE "${BASE_URL}/rest/v1/contacts?id=eq.${cid}" \
        -H "$auth" -H "$api" > /dev/null
    done
    echo "  Deleted test contacts and associated records"
  fi

  # Delete rate limit rows
  curl -s -X DELETE "${BASE_URL}/rest/v1/public_application_rate_limit?email=like.*test-apply*" \
    -H "$auth" -H "$api" > /dev/null
  echo "  Deleted test rate-limit rows"

  # Delete test CV from storage
  curl -s -X DELETE "${BASE_URL}/storage/v1/object/job-board-cvs/${CV_PATH}" \
    -H "$auth" -H "$api" > /dev/null
  echo "  Deleted test CV from storage"

  echo "  Cleanup complete"
}

trap cleanup EXIT

# ── Tests ─────────────────────────────────────────────────────────────────────
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  submit-public-application — curl test harness               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Job slug:   $JOB_SLUG"
echo "  Test email: $TEST_EMAIL"
echo "  CV path:    $CV_PATH"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Validation tests run FIRST — they reject before touching rate-limit state,
# so they won't pollute the IP/email budget for the stateful tests later.
# ──────────────────────────────────────────────────────────────────────────────

# ── 1. Upload test CV ─────────────────────────────────────────────────────────
echo "── 1. Upload test CV to storage ───────────────────────────────"
UPLOAD_RESULT=$(curl -s -w "\n%{http_code}" \
  -X POST "${BASE_URL}/storage/v1/object/job-board-cvs/${CV_PATH}" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/pdf" \
  --data-binary @"$CV_FILE")
UPLOAD_CODE=$(echo "$UPLOAD_RESULT" | tail -1)
check "CV upload succeeds (200/201)" "20" "$UPLOAD_CODE"

# ── 2. Validation: consent=false ──────────────────────────────────────────────
echo ""
echo "── 2. consent=false → 400 ─────────────────────────────────────"
V1_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$FN_URL" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"job_slug\": \"$JOB_SLUG\",
    \"full_name\": \"Test\",
    \"email\": \"v@example.com\",
    \"phone\": \"+962791234567\",
    \"cv_storage_path\": \"applications/test.pdf\",
    \"consent\": false,
    \"captcha_token\": \"$CAPTCHA_TOKEN\"
  }")
V1_CODE=$(echo "$V1_RESULT" | tail -1)
check "consent=false returns 400" "400" "$V1_CODE"

# ── 3. Validation: empty captcha ──────────────────────────────────────────────
echo ""
echo "── 3. Empty captcha_token → 400 ───────────────────────────────"
V2_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$FN_URL" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"job_slug\": \"$JOB_SLUG\",
    \"full_name\": \"Test\",
    \"email\": \"v@example.com\",
    \"phone\": \"+962791234567\",
    \"cv_storage_path\": \"applications/test.pdf\",
    \"consent\": true,
    \"captcha_token\": \"\"
  }")
V2_CODE=$(echo "$V2_RESULT" | tail -1)
check "Empty captcha returns 400" "400" "$V2_CODE"

# ── 4. Validation: bad cv_storage_path ────────────────────────────────────────
echo ""
echo "── 4. Bad cv_storage_path → 400 ───────────────────────────────"
V3_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$FN_URL" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"job_slug\": \"$JOB_SLUG\",
    \"full_name\": \"Test\",
    \"email\": \"v@example.com\",
    \"phone\": \"+962791234567\",
    \"cv_storage_path\": \"badpath/test.pdf\",
    \"consent\": true,
    \"captcha_token\": \"$CAPTCHA_TOKEN\"
  }")
V3_CODE=$(echo "$V3_RESULT" | tail -1)
check "Bad CV path returns 400" "400" "$V3_CODE"

# ── 5. Non-existent job slug ─────────────────────────────────────────────────
# Runs before any successful submissions so the IP hasn't hit rate limits.
echo ""
echo "── 5. Non-existent job slug → 400 ─────────────────────────────"
V4_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$FN_URL" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"job_slug\": \"nonexistent-job-abc123\",
    \"full_name\": \"Test\",
    \"email\": \"v@example.com\",
    \"phone\": \"+962791234567\",
    \"cv_storage_path\": \"applications/test.pdf\",
    \"consent\": true,
    \"captcha_token\": \"$CAPTCHA_TOKEN\"
  }")
V4_CODE=$(echo "$V4_RESULT" | tail -1)
check "Nonexistent job returns 400" "400" "$V4_CODE"

# ── 6. Honeypot ───────────────────────────────────────────────────────────────
echo ""
echo "── 6. Honeypot filled → 200 (silent accept) ──────────────────"
HP_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$FN_URL" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"job_slug\": \"$JOB_SLUG\",
    \"full_name\": \"Bot\",
    \"email\": \"bot@spam.com\",
    \"phone\": \"+000000000\",
    \"cv_storage_path\": \"applications/test.pdf\",
    \"consent\": true,
    \"captcha_token\": \"$CAPTCHA_TOKEN\",
    \"honeypot\": \"I am a bot\"
  }")
HP_CODE=$(echo "$HP_RESULT" | tail -1)
HP_BODY=$(echo "$HP_RESULT" | head -1)
check "Honeypot returns 200" "200" "$HP_CODE"
check "Honeypot returns ok:true" '"ok":true' "$HP_BODY"

# ──────────────────────────────────────────────────────────────────────────────
# Stateful tests — these create real DB rows and consume rate-limit budget.
# ──────────────────────────────────────────────────────────────────────────────

# ── 7. Submit valid application ───────────────────────────────────────────────
echo ""
echo "── 7. Submit valid application ────────────────────────────────"
SUBMIT_RESULT=$(curl -s -X POST "$FN_URL" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"job_slug\": \"$JOB_SLUG\",
    \"full_name\": \"Test Candidate\",
    \"email\": \"$TEST_EMAIL\",
    \"phone\": \"+962791234567\",
    \"location\": \"Amman, Jordan\",
    \"cv_storage_path\": \"$CV_PATH\",
    \"consent\": true,
    \"captcha_token\": \"$CAPTCHA_TOKEN\"
  }")
echo "  Response: $SUBMIT_RESULT"
check "Returns ok:true" '"ok":true' "$SUBMIT_RESULT"
check "Returns redirect_to" 'redirect_to' "$SUBMIT_RESULT"

# ── 8. Duplicate check ───────────────────────────────────────────────────────
echo ""
echo "── 8. Duplicate submission → 409 ──────────────────────────────"
DUP_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$FN_URL" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"job_slug\": \"$JOB_SLUG\",
    \"full_name\": \"Test Candidate\",
    \"email\": \"$TEST_EMAIL\",
    \"phone\": \"+962791234567\",
    \"cv_storage_path\": \"$CV_PATH\",
    \"consent\": true,
    \"captcha_token\": \"$CAPTCHA_TOKEN\"
  }")
DUP_CODE=$(echo "$DUP_RESULT" | tail -1)
DUP_BODY=$(echo "$DUP_RESULT" | head -1)
check "Duplicate returns 409" "409" "$DUP_CODE"
check "Duplicate code is 'duplicate'" '"code":"duplicate"' "$DUP_BODY"

# ── 9. Rate limiting ─────────────────────────────────────────────────────────
echo ""
echo "── 9. Rate limiting (6 rapid requests) ────────────────────────"
RATE_LIMITED=false
for i in $(seq 1 6); do
  RL_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$FN_URL" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"job_slug\": \"$JOB_SLUG\",
      \"full_name\": \"Rate Test $i\",
      \"email\": \"test-apply-rate-${i}-$(date +%s)@example.com\",
      \"phone\": \"+962791111111\",
      \"cv_storage_path\": \"$CV_PATH\",
      \"consent\": true,
      \"captcha_token\": \"$CAPTCHA_TOKEN\"
    }")
  RL_CODE=$(echo "$RL_RESULT" | tail -1)
  if [ "$RL_CODE" = "429" ]; then
    RATE_LIMITED=true
    echo "  → Request $i returned 429 (rate limited)"
    break
  else
    echo "  → Request $i returned $RL_CODE"
  fi
done
if $RATE_LIMITED; then
  check "Rate limit triggered" "true" "true"
else
  check "Rate limit triggered" "true" "false"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "══════════════════════════════════════════════════════════════"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
