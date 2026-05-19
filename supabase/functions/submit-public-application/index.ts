/**
 * Supabase Edge Function: submit-public-application
 * Runtime: Deno (Edge Functions environment)
 *
 * Accepts a POST with JSON body containing job application data from the
 * public job board. Validates input, verifies hCaptcha, enforces rate limits,
 * checks for duplicate applications, then creates contact + application +
 * stage history + activity rows.
 *
 * Auth: callable by anon (only apikey header required, no JWT).
 * Uses service-role internally to bypass RLS for all writes.
 *
 * Email provider: Resend (best-effort, non-blocking).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ────────────────────────────────────────────────────────────────

/** Pipeline stage "Sourced" — first stage for new applications */
const SOURCED_STAGE_ID = 1

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SubmitPayload {
  job_slug: string
  full_name: string
  email: string
  phone: string
  location?: string
  linkedin_url?: string
  cover_message?: string
  cv_storage_path: string
  consent: boolean
  captcha_token: string
  honeypot?: string
}

interface FieldError {
  field: string
  error: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    null
  )
}

/** Truncate last octet of IPv4 for privacy logging. IPv6 truncates last segment. */
function redactIp(ip: string | null): string {
  if (!ip) return 'unknown'
  if (ip.includes('.')) {
    const parts = ip.split('.')
    parts[parts.length - 1] = 'xxx'
    return parts.join('.')
  }
  // IPv6: truncate last segment
  const parts = ip.split(':')
  parts[parts.length - 1] = 'xxxx'
  return parts.join(':')
}

/** Redact email for logging: show first 2 chars + domain */
function redactEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return local.slice(0, 2) + '***@' + domain
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] }
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Validation ───────────────────────────────────────────────────────────────

function validatePayload(body: unknown): { payload: SubmitPayload } | { errors: FieldError[] } {
  if (!body || typeof body !== 'object') {
    return { errors: [{ field: '_', error: 'Invalid payload' }] }
  }

  const b = body as Record<string, unknown>
  const errors: FieldError[] = []

  // Required strings
  const job_slug = String(b.job_slug ?? '').trim()
  if (!job_slug) errors.push({ field: 'job_slug', error: 'Job is required' })

  const full_name = String(b.full_name ?? '').trim()
  if (!full_name) errors.push({ field: 'full_name', error: 'Full name is required' })
  else if (full_name.length > 200) errors.push({ field: 'full_name', error: 'Full name must be under 200 characters' })

  const email = String(b.email ?? '').trim().toLowerCase()
  if (!email) errors.push({ field: 'email', error: 'Email is required' })
  else if (!isValidEmail(email)) errors.push({ field: 'email', error: 'Invalid email address' })

  const phone = String(b.phone ?? '').trim()
  if (!phone) errors.push({ field: 'phone', error: 'Phone number is required' })
  else if (phone.length < 5 || phone.length > 30) errors.push({ field: 'phone', error: 'Phone must be 5-30 characters' })

  const cv_storage_path = String(b.cv_storage_path ?? '').trim()
  if (!cv_storage_path) errors.push({ field: 'cv_storage_path', error: 'CV is required' })
  else if (!cv_storage_path.startsWith('applications/')) errors.push({ field: 'cv_storage_path', error: 'Invalid CV path' })

  const captcha_token = String(b.captcha_token ?? '').trim()
  if (!captcha_token) errors.push({ field: 'captcha_token', error: 'Captcha verification is required' })

  if (b.consent !== true) errors.push({ field: 'consent', error: 'You must consent to data processing' })

  // Optional strings
  const location = b.location ? String(b.location).trim().slice(0, 200) : undefined
  const cover_message = b.cover_message ? String(b.cover_message).trim() : undefined
  if (cover_message && cover_message.length > 2000) {
    errors.push({ field: 'cover_message', error: 'Cover message must be under 2000 characters' })
  }

  const linkedin_url = b.linkedin_url ? String(b.linkedin_url).trim() : undefined
  if (linkedin_url && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(linkedin_url)) {
    errors.push({ field: 'linkedin_url', error: 'Must be a valid LinkedIn URL' })
  }

  const honeypot = b.honeypot ? String(b.honeypot) : undefined

  if (errors.length > 0) return { errors }

  return {
    payload: {
      job_slug, full_name, email, phone, location, linkedin_url,
      cover_message, cv_storage_path, consent: true, captcha_token, honeypot,
    },
  }
}

// ── hCaptcha verification ────────────────────────────────────────────────────

async function verifyCaptcha(token: string, secret: string): Promise<boolean> {
  try {
    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    })
    const data = await res.json()
    return data.success === true
  } catch {
    return false
  }
}

// ── Email builders ───────────────────────────────────────────────────────────

function buildCandidateEmail(candidateName: string, roleTitle: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr>
          <td style="background:#7CCF00;padding:24px 40px;">
            <p style="margin:0;color:#000;font-size:18px;font-weight:700;">New Frontiers Recruitment</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;color:#111827;font-size:15px;">Hi ${escapeHtml(candidateName)},</p>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              Thank you for applying for the <strong>${escapeHtml(roleTitle)}</strong> position.
              We've received your application and our team will review it shortly.
            </p>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>What happens next?</strong><br>
              A member of our recruitment team will review your application and be in touch
              within a few working days. If your profile matches the role requirements,
              we'll reach out to discuss next steps.
            </p>
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">
              In the meantime, feel free to browse our other
              <a href="https://newfrontiersrecruitment.com/jobs" style="color:#16a34a;">open roles</a>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              New Frontiers Recruitment &middot; New Frontiers Business Consultancy
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildRecruiterEmail(
  candidateName: string,
  candidateEmail: string,
  roleTitle: string,
  jobId: string,
  appUrl: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;">New application received</p>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>${escapeHtml(candidateName)}</strong> (${escapeHtml(candidateEmail)})
              has applied for <strong>${escapeHtml(roleTitle)}</strong> via the public job board.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#7CCF00;border-radius:8px;">
                  <a href="${appUrl}/app/jobs/${jobId}" style="display:inline-block;padding:10px 24px;color:#000;font-size:14px;font-weight:600;text-decoration:none;">
                    View application &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // Method check
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed', code: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const hcaptchaSecret = Deno.env.get('HCAPTCHA_SECRET') ?? '0x0000000000000000000000000000000000000000'
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'New Frontiers Recruitment <noreply@newfrontiersrecruitment.com>'
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5176'
  const clientIp = getClientIp(req)

  // Service-role client — bypasses RLS
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // ── Parse JSON ───────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON payload', code: 'invalid_payload' }, 400)
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  const result = validatePayload(body)
  if ('errors' in result) {
    return json({ ok: false, error: 'Validation failed', code: 'validation_error', fields: result.errors }, 400)
  }
  const payload = result.payload

  // ── Honeypot ─────────────────────────────────────────────────────────────
  if (payload.honeypot) {
    // Silently accept — don't insert anything
    console.log(`[submit-application] honeypot triggered, ip=${redactIp(clientIp)}`)
    return json({ ok: true, redirect_to: `/jobs/${payload.job_slug}/applied` })
  }

  // ── hCaptcha ─────────────────────────────────────────────────────────────
  const captchaOk = await verifyCaptcha(payload.captcha_token, hcaptchaSecret)
  if (!captchaOk) {
    console.log(`[submit-application] captcha failed, ip=${redactIp(clientIp)}, email=${redactEmail(payload.email)}`)
    return json({ ok: false, error: 'Captcha verification failed. Please try again.', code: 'captcha_failed' }, 400)
  }

  // ── Rate limit ───────────────────────────────────────────────────────────
  try {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    let query = admin
      .from('public_application_rate_limit')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo)

    if (clientIp) {
      query = query.or(`ip.eq.${clientIp},email.eq.${payload.email}`)
    } else {
      query = query.eq('email', payload.email)
    }

    const { count } = await query
    if ((count ?? 0) >= 5) {
      console.log(`[submit-application] rate limited, ip=${redactIp(clientIp)}, email=${redactEmail(payload.email)}`)
      return json({ ok: false, error: 'Too many requests. Please try again in a few minutes.', code: 'rate_limited' }, 429)
    }
  } catch (err) {
    console.error('[submit-application] rate limit check failed:', err)
    // Don't block on rate limit check failure — proceed
  }

  // ── Job lookup ───────────────────────────────────────────────────────────
  const { data: jobRow, error: jobErr } = await admin
    .from('public_jobs')
    .select('id, title')
    .eq('slug', payload.job_slug)
    .maybeSingle()

  if (jobErr || !jobRow) {
    console.log(`[submit-application] job not found: ${payload.job_slug}`)
    return json({ ok: false, error: 'This role is no longer accepting applications.', code: 'job_not_found' }, 400)
  }

  const jobId = jobRow.id as string
  const jobTitle = jobRow.title as string

  // ── Duplicate check ──────────────────────────────────────────────────────
  const { data: dupResult } = await admin.rpc('has_duplicate_application', {
    p_email: payload.email,
    p_job_id: jobId,
    p_window_days: 30,
  })

  if (dupResult === true) {
    console.log(`[submit-application] duplicate, email=${redactEmail(payload.email)}, job=${payload.job_slug}`)
    return json({ ok: false, error: "We've already received your application for this role.", code: 'duplicate' }, 409)
  }

  // ── Insert data ──────────────────────────────────────────────────────────
  try {
    // a) Look up or create contact
    const { data: existingContact } = await admin
      .from('contacts')
      .select('id')
      .ilike('email', payload.email)
      .maybeSingle()

    let contactId: string

    if (existingContact) {
      contactId = existingContact.id
      // Update GDPR consent timestamp
      await admin
        .from('contacts')
        .update({ gdpr_consent_at: new Date().toISOString() })
        .eq('id', contactId)
    } else {
      const { firstName, lastName } = splitFullName(payload.full_name)
      const { data: newContact, error: contactErr } = await admin
        .from('contacts')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: payload.email,
          phone: payload.phone,
          candidate_location: payload.location ?? null,
          linkedin_url: payload.linkedin_url ?? null,
          contact_type: 'candidate',
          candidate_source: 'job_board',
          candidate_source_detail: `Applied via public job board: ${jobTitle}`,
          gdpr_consent_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (contactErr || !newContact) {
        console.error('[submit-application] contact insert failed:', contactErr?.message)
        return json({ ok: false, error: 'Something went wrong. Please try again.', code: 'server_error' }, 500)
      }
      contactId = newContact.id
    }

    // b) Insert application
    const { data: newApp, error: appErr } = await admin
      .from('applications')
      .insert({
        contact_id: contactId,
        job_id: jobId,
        stage_id: SOURCED_STAGE_ID,
        status: 'active',
        source: 'job_board',
        cv_storage_path: payload.cv_storage_path,
        applied_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (appErr || !newApp) {
      console.error('[submit-application] application insert failed:', appErr?.message)
      return json({ ok: false, error: 'Something went wrong. Please try again.', code: 'server_error' }, 500)
    }

    const applicationId = newApp.id

    // c) Insert stage history
    await admin
      .from('application_stage_history')
      .insert({
        application_id: applicationId,
        from_stage_id: null,
        to_stage_id: SOURCED_STAGE_ID,
        moved_by: null,
        reason: 'Initial stage on application submission via public job board',
      })

    // d) Insert activity
    await admin
      .from('activities')
      .insert({
        subject_type: 'application',
        subject_id: applicationId,
        activity_type: 'application_received',
        title: `Application received for ${jobTitle}`,
        body: `${payload.full_name} applied via the public job board.`,
        created_by: null,
      })

    // e) Insert rate-limit row
    await admin
      .from('public_application_rate_limit')
      .insert({
        ip: clientIp ?? 'unknown',
        email: payload.email,
        job_id: jobId,
      })

    // f) Best-effort emails (non-blocking)
    if (resendKey) {
      // Candidate confirmation email
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromEmail,
            to: [payload.email],
            subject: `Thanks for applying to ${jobTitle}`,
            html: buildCandidateEmail(payload.full_name, jobTitle),
          }),
        })
      } catch (emailErr) {
        console.error('[submit-application] candidate email failed:', emailErr)
      }

      // Recruiter notification email
      try {
        const { data: jobFull } = await admin
          .from('jobs')
          .select('owner_id')
          .eq('id', jobId)
          .maybeSingle()

        if (jobFull?.owner_id) {
          const { data: recruiter } = await admin
            .from('profiles')
            .select('email')
            .eq('id', jobFull.owner_id)
            .maybeSingle()

          if (recruiter?.email) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: fromEmail,
                to: [recruiter.email],
                subject: `New application for ${jobTitle}`,
                html: buildRecruiterEmail(payload.full_name, payload.email, jobTitle, jobId, appUrl),
              }),
            })
          }
        }
      } catch (emailErr) {
        console.error('[submit-application] recruiter email failed:', emailErr)
      }
    }

    console.log(`[submit-application] success, job=${payload.job_slug}, email=${redactEmail(payload.email)}, ip=${redactIp(clientIp)}`)
    return json({ ok: true, redirect_to: `/jobs/${payload.job_slug}/applied` })

  } catch (err) {
    console.error('[submit-application] unexpected error:', err)
    return json({ ok: false, error: 'Something went wrong. Please try again.', code: 'server_error' }, 500)
  }
})
