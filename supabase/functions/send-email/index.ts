/**
 * Supabase Edge Function: send-email
 * Runtime: Deno (Edge Functions environment)
 *
 * Accepts a POST with JSON body:
 *   { to, subject, body_html, body_text?, cc?, bcc?,
 *     template_id?, related_entity_type?, related_entity_id? }
 *
 * Auth: requires valid JWT in Authorization header (forwarded by Supabase
 *       automatically when called via supabase.functions.invoke).
 *
 * Email provider: Resend (https://resend.com).
 *   - Set RESEND_API_KEY as a Supabase secret.
 *   - If the key is absent, the email is logged with status='queued'
 *     and success=true (graceful degradation).
 *
 * Returns: { success: boolean, email_log_id: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth ───────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')

    // Build a Supabase client that honours the caller's JWT for RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        auth:   { autoRefreshToken: false, persistSession: false },
      }
    )

    // Verify the JWT by fetching the calling user — pass token explicitly
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Parse body ─────────────────────────────────────────────────────────────
    const body = await req.json() as {
      to:                   string
      subject:              string
      body_html:            string
      body_text?:           string
      cc?:                  string
      bcc?:                 string
      template_id?:         string
      related_entity_type?: string
      related_entity_id?:   string
    }

    const { to, subject, body_html, body_text, cc, bcc,
            template_id, related_entity_type, related_entity_id } = body

    if (!to || !subject || !body_html) {
      return new Response(JSON.stringify({ error: 'to, subject, and body_html are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Attempt to send via Resend ─────────────────────────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY')
    let status: 'sent' | 'queued' | 'failed' = 'queued'
    let errorMessage: string | null = null

    if (resendKey) {
      try {
        const fromAddress = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@recruitmentdb.app'

        const resendPayload: Record<string, unknown> = {
          from:    fromAddress,
          to:      [to],
          subject,
          html:    body_html,
        }
        if (body_text) resendPayload.text = body_text
        if (cc)        resendPayload.cc   = [cc]
        if (bcc)       resendPayload.bcc  = [bcc]

        const res = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify(resendPayload),
        })

        if (res.ok) {
          status = 'sent'
        } else {
          const errBody = await res.text()
          status       = 'failed'
          errorMessage = `Resend ${res.status}: ${errBody}`
        }
      } catch (sendErr) {
        status       = 'failed'
        errorMessage = String(sendErr)
      }
    }
    // If no RESEND_API_KEY: status remains 'queued' — graceful degradation

    // ── Log the email (service-role client for reliable insert) ────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const logRow: Record<string, unknown> = {
      template_id:          template_id          ?? null,
      to_email:             to,
      cc:                   cc                   ?? null,
      bcc:                  bcc                  ?? null,
      subject,
      body:                 body_text ?? body_html,
      status,
      error_message:        errorMessage,
      related_entity_type:  related_entity_type  ?? null,
      related_entity_id:    related_entity_id    ?? null,
      sent_by:              user.id,
      sent_at:              status === 'sent' ? new Date().toISOString() : null,
    }

    const { data: logRow_, error: logErr } = await adminClient
      .from('email_log')
      .insert(logRow)
      .select('id')
      .single()

    if (logErr) {
      console.error('Failed to log email:', logErr.message)
    }

    return new Response(
      JSON.stringify({
        success:       status !== 'failed',
        status,
        email_log_id:  (logRow_ as { id: string } | null)?.id ?? null,
        queued:        status === 'queued',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-email error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
