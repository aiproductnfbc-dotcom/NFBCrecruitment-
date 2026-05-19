import { supabase } from './supabaseClient'

// ── Types ──────────────────────────────────────────────────────────────────────

export type InviteRole = 'admin' | 'account_manager' | 'recruiter' | 'viewer'
export type InviteMode = 'magic_link' | 'password_email'

export interface InviteInput {
  email:                  string
  full_name:              string
  roles:                  InviteRole[]
  mode:                   InviteMode
  temporary_password?:    string
  auto_generate_password?: boolean
}

export type InviteResult =
  | { ok: true;  invitation_id: string; user_id: string | null; mode: InviteMode }
  | { ok: false; error: string; message: string }

export interface PendingInvitation {
  id:                string
  email:             string
  full_name:         string | null
  roles:             string[]
  mode:              InviteMode
  status:            'sent' | 'accepted' | 'expired' | 'failed' | 'revoked'
  sent_at:           string
  expires_at:        string
  error_message:     string | null
  invited_by_name:   string | null
  invited_by_email:  string | null
}

// ── Send invite ───────────────────────────────────────────────────────────────

export async function inviteUser(input: InviteInput): Promise<InviteResult> {
  const { data, error } = await supabase.functions.invoke<InviteResult>('invite-user', {
    body: input,
  })

  if (error) {
    // Supabase wraps non-2xx responses in a FunctionsHttpError — the actual
    // JSON body (with our { ok, error, message } shape) lives in error.context
    try {
      const body = await (error as any).context?.json?.()
      if (body?.message) {
        return { ok: false, error: body.error ?? 'unknown', message: body.message }
      }
    } catch {
      // ignore — fall through to generic message
    }
    return { ok: false, error: 'unknown', message: error.message }
  }

  return data ?? { ok: false, error: 'unknown', message: 'No response from server' }
}

// ── List pending invitations ──────────────────────────────────────────────────

export async function listPendingInvitations(): Promise<PendingInvitation[]> {
  // First expire any stale ones
  await supabase.rpc('expire_old_invitations')

  const { data, error } = await supabase
    .from('pending_invitations')
    .select('*')
    .order('sent_at', { ascending: false })

  if (error) throw new Error(`listPendingInvitations: ${error.message}`)
  return (data ?? []) as PendingInvitation[]
}

// ── Revoke invitation ─────────────────────────────────────────────────────────

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invitation', { invitation_id: id })
  if (error) throw new Error(error.message)
}

// ── Resend invite ─────────────────────────────────────────────────────────────
// Revokes all open invitations for the email first, then sends a fresh one.

export async function resendInvitation(inv: PendingInvitation): Promise<InviteResult> {
  // Revoke any existing open invites for this address to avoid duplicates
  await supabase.rpc('revoke_invitations_by_email', { target_email: inv.email })

  return inviteUser({
    email:     inv.email,
    full_name: inv.full_name ?? '',
    roles:     inv.roles as InviteRole[],
    mode:      inv.mode,
    auto_generate_password: inv.mode === 'password_email',
  })
}
