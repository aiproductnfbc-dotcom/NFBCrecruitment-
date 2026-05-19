/**
 * Edge Function: send-password-reset
 *
 * Generates a password-recovery link via the admin API (bypasses the Supabase
 * Site URL / redirect URL allowlist) and delivers it via Resend.
 *
 * POST body: { email: string }
 * Auth: caller must be an admin (same JWT check as invite-user).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey      = Deno.env.get('RESEND_API_KEY')
  const fromEmail      = Deno.env.get('INVITE_EMAIL_FROM') ?? 'NFBC Recruitment <noreply@recruitment.app>'
  const appUrl         = Deno.env.get('APP_URL') ?? 'https://recruitment-db.vercel.app'

  // ── Auth: verify caller is an admin ──────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ ok: false, message: 'Missing Authorization header' }, 401)

  const token = authHeader.replace(/^Bearer\s+/i, '')
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser(token)
  if (authErr || !caller) return json({ ok: false, message: 'Invalid token' }, 401)

  const { data: rolesData } = await callerClient.from('my_roles').select('slug')
  const callerRoles = (rolesData ?? []).map((r: { slug: string }) => r.slug)
  if (!callerRoles.includes('admin')) return json({ ok: false, message: 'Admin role required' }, 403)

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { email: string }
  try { body = await req.json() }
  catch { return json({ ok: false, message: 'Invalid JSON' }, 400) }

  const { email } = body
  if (!email) return json({ ok: false, message: 'email is required' }, 400)

  // ── Generate recovery link via admin API ──────────────────────────────────
  // generateLink uses the service role key → bypasses the Supabase Site URL
  // allowlist, so the redirectTo always points to production.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type:       'recovery',
    email,
    options: {
      redirectTo: `${appUrl}/auth/reset-password`,
    },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    console.error('generateLink failed:', linkErr?.message)
    return json({ ok: false, message: linkErr?.message ?? 'Failed to generate reset link' }, 500)
  }

  const resetLink = linkData.properties.action_link

  // ── Send via Resend ───────────────────────────────────────────────────────
  if (!resendKey) {
    // No Resend key — return the link so the admin can share it manually
    console.warn('RESEND_API_KEY not set — returning link directly')
    return json({ ok: true, link: resetLink })
  }

  const html = buildResetEmail({ email, resetLink, sentBy: caller.user_metadata?.full_name ?? caller.email ?? 'Your administrator' })

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    fromEmail,
      to:      [email],
      subject: 'Reset your NFBC Recruitment password',
      html,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Resend failed:', errText)
    // Return the link so the admin can share it manually even when email fails
    return json({ ok: true, emailFailed: true, link: resetLink, emailError: errText })
  }

  return json({ ok: true })
})

// ── Email template ────────────────────────────────────────────────────────────

function buildResetEmail(p: { email: string; resetLink: string; sentBy: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr>
          <td style="background:#7CCF00;padding:24px 36px;">
            <p style="margin:0;color:#000;font-size:17px;font-weight:700;">New Frontiers Business Consultancy</p>
            <p style="margin:4px 0 0;color:#1a3300;font-size:12px;">Recruitment Database</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 16px;color:#111827;font-size:15px;">Hi,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>${escapeHtml(p.sentBy)}</strong> has sent you a password reset link for your NFBC Recruitment account
              (<strong>${escapeHtml(p.email)}</strong>). Click the button below to choose a new password.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#7CCF00;border-radius:8px;">
                  <a href="${p.resetLink}" style="display:inline-block;padding:12px 28px;color:#000;font-size:14px;font-weight:600;text-decoration:none;">
                    Reset password →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">This link expires in 1 hour.</p>
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 36px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">New Frontiers Business Consultancy · Recruitment Database</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
