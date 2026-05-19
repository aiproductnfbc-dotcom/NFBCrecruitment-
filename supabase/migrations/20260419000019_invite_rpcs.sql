-- =============================================================================
-- MIGRATION: 20260419000019_invite_rpcs
-- PURPOSE:   Add SECURITY DEFINER RPCs for invitation lifecycle management.
--            Fixes:
--              1. revoke_invitation — admin-only revoke (replaces missing edge fn)
--              2. accept_invitation — invited user marks their own invite accepted
--              3. revoke_invitations_by_email — revokes all open invites for an
--                 email, used by resend flow to prevent duplicate active invites
-- =============================================================================

-- ── 1. revoke_invitation ──────────────────────────────────────────────────────
-- Admins call this to cancel a pending or failed invitation.

CREATE OR REPLACE FUNCTION public.revoke_invitation(invitation_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required to revoke invitations';
  END IF;

  UPDATE public.user_invitations
  SET   status = 'revoked'
  WHERE id     = invitation_id
    AND status IN ('sent', 'failed');

  -- Not finding the row is non-fatal (already revoked/accepted/expired is fine)
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_invitation(uuid) TO authenticated;

-- ── 2. accept_invitation ──────────────────────────────────────────────────────
-- Called by the invited user immediately after setting their password.
-- Validates that the invitation_id belongs to the caller via auth_user_id.

CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE public.user_invitations
  SET   status      = 'accepted',
        accepted_at = now()
  WHERE id           = invitation_id
    AND auth_user_id = auth.uid()
    AND status       = 'sent';

  -- Silently succeeds even if the invitation was already accepted or expired
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

-- ── 3. revoke_invitations_by_email ────────────────────────────────────────────
-- Revokes all open (sent / failed) invitations for a given email address.
-- Called by the resend flow before issuing a new invite so there's only ever
-- one active invitation per address.

CREATE OR REPLACE FUNCTION public.revoke_invitations_by_email(target_email text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  UPDATE public.user_invitations
  SET   status = 'revoked'
  WHERE email  = lower(trim(target_email))
    AND status IN ('sent', 'failed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_invitations_by_email(text) TO authenticated;
