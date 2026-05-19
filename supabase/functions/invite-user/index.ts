/**
 * Supabase Edge Function: invite-user
 * Runtime: Deno
 *
 * POST body:
 *   {
 *     email: string
 *     full_name: string
 *     roles: Array<'admin' | 'account_manager' | 'recruiter' | 'viewer'>
 *     mode: 'magic_link' | 'password_email'
 *     temporary_password?: string   // required if mode=password_email and auto_generate=false
 *     auto_generate_password?: boolean
 *   }
 *
 * Auth: requires valid JWT (forwarded automatically by supabase.functions.invoke).
 *       Caller must have the 'admin' role — checked against public.user_roles.
 *
 * Returns:
 *   { ok: true,  invitation_id, user_id, mode }
 *   { ok: false, error: string, message: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_ROLES = new Set(['admin', 'account_manager', 'recruiter', 'viewer'])

// ── Crypto helpers ────────────────────────────────────────────────────────────

/** Generates a cryptographically random password: 16 chars, alpha + digits + 2 symbols */
function generatePassword(): string {
  const alpha   = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const digits  = '0123456789'
  const symbols = '!@#$%^&*'
  const all     = alpha + digits + symbols

  const bytes  = new Uint8Array(24)
  crypto.getRandomValues(bytes)

  // Guarantee at least one symbol
  let pw = String.fromCharCode(
    ...Array.from(bytes).map(b => all.charCodeAt(b % all.length))
  ).slice(0, 14)

  const sym1 = symbols[bytes[14] % symbols.length]
  const sym2 = symbols[bytes[15] % symbols.length]
  pw = pw + sym1 + sym2

  // Shuffle
  const arr = pw.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = bytes[i % bytes.length] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

// ── Response helper ───────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl      = Deno.env.get('SUPABASE_URL')!
  const anonKey          = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey        = Deno.env.get('RESEND_API_KEY')
  const fromEmail        = Deno.env.get('INVITE_EMAIL_FROM') ?? 'NFBC Recruitment <noreply@recruitment.app>'
  const appUrl           = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

  // ── Auth — verify caller has admin role ────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ ok: false, error: 'not_authorized', message: 'Missing Authorization header' }, 401)

  const token = authHeader.replace(/^Bearer\s+/i, '')

  // User-scoped client — pass token directly to getUser() which is the
  // reliable pattern inside Deno edge functions (avoids session persistence issues)
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { autoRefreshToken: false, persistSession: false },
  })

  // Verify JWT and get caller identity — pass token explicitly
  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser(token)
  if (authErr || !caller) {
    console.error('auth.getUser failed:', authErr?.message)
    return json({ ok: false, error: 'not_authorized', message: 'Invalid token' }, 401)
  }

  // Check admin role via the my_roles view (RLS-filtered to caller)
  const { data: rolesData, error: rolesErr } = await callerClient.from('my_roles').select('slug')
  if (rolesErr) console.error('my_roles query failed:', rolesErr.message)
  const callerRoles = (rolesData ?? []).map((r: { slug: string }) => r.slug)
  if (!callerRoles.includes('admin')) {
    return json({ ok: false, error: 'not_authorized', message: 'Admin role required' }, 403)
  }

  // Service-role client — bypasses RLS for auth admin calls + writes
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // ── Rate limit — max 20 invites per admin per hour ────────────────────────
  const { count: recentCount } = await adminClient
    .from('user_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('invited_by', caller.id)
    .gte('sent_at', new Date(Date.now() - 3_600_000).toISOString())

  if ((recentCount ?? 0) >= 20) {
    return json({ ok: false, error: 'rate_limited', message: 'Maximum 20 invites per hour. Try again later.' }, 429)
  }

  // ── Parse & validate body ─────────────────────────────────────────────────
  let body: {
    email: string
    full_name: string
    roles: string[]
    mode: 'magic_link' | 'password_email'
    temporary_password?: string
    auto_generate_password?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'bad_request', message: 'Invalid JSON body' }, 400)
  }

  const { email, full_name, roles, mode, auto_generate_password } = body
  let { temporary_password } = body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'bad_request', message: 'Valid email is required' }, 400)
  }
  if (!full_name?.trim()) {
    return json({ ok: false, error: 'bad_request', message: 'Full name is required' }, 400)
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    return json({ ok: false, error: 'invalid_role', message: 'At least one role is required' }, 400)
  }
  for (const r of roles) {
    if (!VALID_ROLES.has(r)) {
      return json({ ok: false, error: 'invalid_role', message: `Unknown role: ${r}` }, 400)
    }
  }
  if (mode !== 'magic_link' && mode !== 'password_email') {
    return json({ ok: false, error: 'bad_request', message: 'mode must be magic_link or password_email' }, 400)
  }
  if (mode === 'password_email') {
    if (auto_generate_password) {
      temporary_password = generatePassword()
    } else if (!temporary_password) {
      return json({ ok: false, error: 'bad_request', message: 'temporary_password required when not auto-generating' }, 400)
    }
    if (temporary_password && temporary_password.length < 8) {
      return json({ ok: false, error: 'bad_request', message: 'Password must be at least 8 characters' }, 400)
    }
  }

  // ── Check for duplicate email ─────────────────────────────────────────────
  const { data: existing } = await adminClient.auth.admin.listUsers()
  const duplicate = (existing?.users ?? []).find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (duplicate) {
    // For magic_link: if the user hasn't confirmed yet (first invite was never
    // completed), Supabase allows re-inviting — just proceed and let
    // inviteUserByEmail resend the magic link to the existing auth record.
    if (mode === 'magic_link' && !duplicate.email_confirmed_at) {
      // Allow fall-through — inviteUserByEmail handles unconfirmed re-invites
    } else {
      const msg = duplicate.email_confirmed_at
        ? `${email} already has an active account. Ask them to use "Forgot password" if they can't log in.`
        : `A pending invite already exists for ${email}. Check the invitations list to resend.`
      return json({ ok: false, error: 'duplicate_email', message: msg }, 409)
    }
  }

  // ── Create invitation log row first (so we can mark failed if needed) ─────
  const { data: invRow, error: invCreateErr } = await adminClient
    .from('user_invitations')
    .insert({
      email,
      full_name: full_name.trim(),
      roles,
      invited_by: caller.id,
      mode,
      status: 'sent',
    })
    .select('id')
    .single()

  if (invCreateErr || !invRow) {
    console.error('Failed to create invitation row:', invCreateErr?.message)
    return json({ ok: false, error: 'unknown', message: 'Failed to record invitation' }, 500)
  }

  const invitationId = (invRow as { id: string }).id

  // Helper: mark invitation as failed
  async function markFailed(message: string) {
    await adminClient.from('user_invitations').update({
      status: 'failed',
      error_message: message,
    }).eq('id', invitationId)
  }

  // ── Write audit log ───────────────────────────────────────────────────────
  await adminClient.from('audit_logs').insert({
    actor_id:    caller.id,
    action:      'invite',
    entity_type: 'user_invitation',
    entity_id:   invitationId,
    after_json:  { email, full_name, roles, mode },
    ip:          req.headers.get('x-forwarded-for') ?? null,
    user_agent:  req.headers.get('user-agent')      ?? null,
  })

  // ── Mode A: Magic Link ────────────────────────────────────────────────────
  if (mode === 'magic_link') {
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${appUrl}/auth/accept-invite`,
        data: {
          full_name:      full_name.trim(),
          roles,
          invited_by:     caller.id,
          invited_by_name: caller.user_metadata?.full_name ?? caller.email,
          invitation_id:  invitationId,
        },
      }
    )

    if (inviteErr) {
      await markFailed(inviteErr.message)
      return json({ ok: false, error: 'email_send_failed', message: inviteErr.message }, 500)
    }

    const authUserId = inviteData.user?.id ?? null

    // Update invitation with the auth user id
    await adminClient.from('user_invitations').update({ auth_user_id: authUserId }).eq('id', invitationId)

    // Assign roles in user_roles (profile row created by trigger)
    if (authUserId) {
      await assignRolesToUser(adminClient, authUserId, roles)
    }

    return json({ ok: true, invitation_id: invitationId, user_id: authUserId, mode: 'magic_link' })
  }

  // ── Mode B: Password Email ────────────────────────────────────────────────
  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password:      temporary_password!,
    email_confirm: true,
    user_metadata: {
      full_name:            full_name.trim(),
      roles,
      invited_by:           caller.id,
      invited_by_name:      caller.user_metadata?.full_name ?? caller.email,
      invitation_id:        invitationId,
      must_change_password: true,
    },
  })

  if (createErr) {
    await markFailed(createErr.message)
    return json({ ok: false, error: 'unknown', message: createErr.message }, 500)
  }

  const authUserId = newUser.user?.id

  // Update invitation with auth user id
  await adminClient.from('user_invitations').update({ auth_user_id: authUserId ?? null }).eq('id', invitationId)

  // Assign roles
  if (authUserId) {
    await assignRolesToUser(adminClient, authUserId, roles)
  }

  // Send credentials email via Resend
  if (resendKey) {
    const callerName = caller.user_metadata?.full_name ?? caller.email ?? 'Your administrator'
    const loginUrl   = `${appUrl}/login`
    const html       = buildPasswordEmail({ full_name: full_name.trim(), email, password: temporary_password!, invited_by_name: callerName, login_url: loginUrl })

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    fromEmail,
          to:      [email],
          subject: "You've been invited to NFBC Recruitment — your login details",
          html,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        await markFailed(`Resend ${res.status}: ${errText}`)
        // Don't return error — user was created; admin can see credentials in the invitation row
        console.error('Email send failed:', errText)
      }
    } catch (sendErr) {
      await markFailed(String(sendErr))
      console.error('Email send threw:', sendErr)
    }
  } else {
    // No Resend key — log warning but don't fail (graceful degradation)
    console.warn('RESEND_API_KEY not set — credentials email not sent for invitation', invitationId)
  }

  return json({ ok: true, invitation_id: invitationId, user_id: authUserId, mode: 'password_email' })
})

// ── Role assignment helper ────────────────────────────────────────────────────

async function assignRolesToUser(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  roles: string[]
) {
  // Fetch role IDs
  const { data: roleRows } = await adminClient
    .from('roles')
    .select('id, slug')
    .in('slug', roles)

  if (!roleRows?.length) return

  // Wait briefly for the profile trigger to fire (auth.users → profiles)
  await new Promise(r => setTimeout(r, 500))

  const inserts = roleRows.map((r: { id: number; slug: string }) => ({
    user_id:  userId,
    role_id:  r.id,
  }))

  await adminClient.from('user_roles').upsert(inserts, { onConflict: 'user_id,role_id', ignoreDuplicates: true })
}

// ── Password email HTML ───────────────────────────────────────────────────────

function buildPasswordEmail(params: {
  full_name: string
  email: string
  password: string
  invited_by_name: string
  login_url: string
}): string {
  const { full_name, email, password, invited_by_name, login_url } = params
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to NFBC Recruitment</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#7CCF00;padding:28px 40px;">
            <p style="margin:0;color:#000;font-size:18px;font-weight:700;">New Frontiers Business Consultancy</p>
            <p style="margin:4px 0 0;color:#1a3300;font-size:13px;">Recruitment Database</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;color:#111827;font-size:15px;">Hi ${escapeHtml(full_name)},</p>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
              You've been invited by <strong>${escapeHtml(invited_by_name)}</strong> to join the NFBC Recruitment Database.
              Here are your login credentials:
            </p>

            <!-- Credentials box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Your credentials</p>
                  <p style="margin:0 0 8px;color:#111827;font-size:14px;"><span style="color:#6b7280;width:80px;display:inline-block;">Email:</span> <strong>${escapeHtml(email)}</strong></p>
                  <p style="margin:0;color:#111827;font-size:14px;"><span style="color:#6b7280;width:80px;display:inline-block;">Password:</span> <code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:14px;font-family:monospace;">${escapeHtml(password)}</code></p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#7CCF00;border-radius:8px;">
                  <a href="${login_url}" style="display:inline-block;padding:12px 28px;color:#000;font-size:14px;font-weight:600;text-decoration:none;">
                    Log in →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde047;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;color:#713f12;font-size:13px;line-height:1.5;">
                    ⚠️ <strong>You'll be asked to change this password</strong> on your first login.
                    Please keep these credentials secure and do not share them.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#9ca3af;font-size:12px;">
              If you weren't expecting this invitation, please ignore this email or contact your administrator.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              New Frontiers Business Consultancy · Recruitment Database
            </p>
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
