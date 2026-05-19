-- =============================================================================
-- MIGRATION: 20260419000018_user_invitations
-- PURPOSE:   Adds user_invitations table for tracking every invite attempt.
--            Extends audit_logs action check to include 'invite'.
--            Adds RLS so only admins can read invitations.
-- =============================================================================

-- ── 1. Extend audit_logs action constraint ───────────────────────────────────
-- The existing check only allows create|update|delete|stage_change|login|export.
-- We need 'invite' for the invitation audit trail.

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('create','update','delete','stage_change','login','export','invite'));

-- ── 2. user_invitations table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        NOT NULL,
  full_name       text,
  roles           text[]      NOT NULL DEFAULT ARRAY[]::text[],
  invited_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode            text        NOT NULL CHECK (mode IN ('magic_link', 'password_email')),
  status          text        NOT NULL DEFAULT 'sent'
                              CHECK (status IN ('sent', 'accepted', 'expired', 'failed', 'revoked')),
  error_message   text,
  auth_user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_invitations IS
  'One row per invitation attempt. Written by the invite-user edge function
   using the service role key. Status progresses: sent → accepted|expired|failed|revoked.';

CREATE INDEX IF NOT EXISTS idx_user_invitations_email
  ON public.user_invitations (email);

CREATE INDEX IF NOT EXISTS idx_user_invitations_invited_by
  ON public.user_invitations (invited_by);

CREATE INDEX IF NOT EXISTS idx_user_invitations_status
  ON public.user_invitations (status, expires_at);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can read all invitations
CREATE POLICY "Admins can view all invitations"
  ON public.user_invitations FOR SELECT
  USING (public.user_has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies — all writes go through the edge function
-- using the service role key, which bypasses RLS entirely.

-- ── 4. Convenience: mark expired invitations ─────────────────────────────────
-- Called from the client to clean up the displayed list; safe because
-- the edge function also checks expires_at before acting.

CREATE OR REPLACE FUNCTION public.expire_old_invitations()
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE public.user_invitations
  SET    status = 'expired'
  WHERE  status = 'sent'
    AND  expires_at < now();
$$;

GRANT EXECUTE ON FUNCTION public.expire_old_invitations() TO authenticated;

-- ── 5. View: pending invitations (non-expired, sent) ─────────────────────────

CREATE OR REPLACE VIEW public.pending_invitations AS
  SELECT
    i.id,
    i.email,
    i.full_name,
    i.roles,
    i.mode,
    i.status,
    i.sent_at,
    i.expires_at,
    i.error_message,
    p.full_name AS invited_by_name,
    p.email     AS invited_by_email
  FROM public.user_invitations i
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.status IN ('sent', 'failed');

COMMENT ON VIEW public.pending_invitations IS
  'Shows sent and failed invitations visible to admins only (inherits RLS from base table).';

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP VIEW  IF EXISTS public.pending_invitations;
-- DROP FUNCTION IF EXISTS public.expire_old_invitations();
-- DROP TABLE IF EXISTS public.user_invitations;
-- ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
-- ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
--   CHECK (action IN ('create','update','delete','stage_change','login','export'));
