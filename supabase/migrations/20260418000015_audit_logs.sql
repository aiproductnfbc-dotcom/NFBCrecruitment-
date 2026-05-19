-- =============================================================================
-- MIGRATION: 20260418000015_audit_logs
-- PURPOSE:   Creates the audit_logs table and a generic trigger function that
--            fires on INSERT, UPDATE, DELETE for 6 core tables.
--            All writes are captured with actor, action, before/after JSON.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── 1. audit_logs table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action       text        NOT NULL
    CONSTRAINT audit_logs_action_check
      CHECK (action IN ('create','update','delete','stage_change','login','export')),
  entity_type  text        NOT NULL,
  entity_id    uuid,
  before_json  jsonb,
  after_json   jsonb,
  ip           text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS
  'Append-only audit trail. Never update or delete rows.
   action: create|update|delete|stage_change|login|export
   Trigger-populated for INSERT/UPDATE/DELETE on 6 core tables.';

CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON public.audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON public.audit_logs (actor_id, created_at DESC);

-- ── 2. RLS — audit_logs ───────────────────────────────────────────────────────

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read the audit trail
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.user_has_role('admin'));

-- Authenticated users can insert (trigger is SECURITY DEFINER but service-layer
-- logging also needs this for login/export events)
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE policies — audit logs are immutable

-- ── 3. Generic audit trigger function ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action      text;
  v_before      jsonb := NULL;
  v_after       jsonb := NULL;
  v_entity_id   uuid;
BEGIN
  -- Determine action and capture before/after snapshots
  IF TG_OP = 'INSERT' THEN
    v_action    := 'create';
    v_after     := to_jsonb(NEW);
    v_entity_id := NEW.id;

  ELSIF TG_OP = 'UPDATE' THEN
    v_before    := to_jsonb(OLD);
    v_after     := to_jsonb(NEW);
    v_entity_id := NEW.id;
    -- Special-case: applications stage moves get a more descriptive action
    IF TG_TABLE_NAME = 'applications'
       AND (OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
      v_action := 'stage_change';
    ELSE
      v_action := 'update';
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action    := 'delete';
    v_before    := to_jsonb(OLD);
    v_entity_id := OLD.id;
  END IF;

  INSERT INTO public.audit_logs
    (actor_id, action, entity_type, entity_id, before_json, after_json)
  VALUES
    (auth.uid(), v_action, TG_TABLE_NAME, v_entity_id, v_before, v_after);

  -- AFTER triggers: return value is ignored; return something valid
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.audit_trigger_fn IS
  'Generic AFTER trigger that logs every INSERT/UPDATE/DELETE to audit_logs.
   Detects stage_change on applications automatically.
   SECURITY DEFINER so auth.uid() resolves in the calling user''s JWT context.';

-- ── 4. Attach audit triggers to 6 core tables ─────────────────────────────────

-- contacts
DROP TRIGGER IF EXISTS audit_contacts ON public.contacts;
CREATE TRIGGER audit_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- jobs
DROP TRIGGER IF EXISTS audit_jobs ON public.jobs;
CREATE TRIGGER audit_jobs
  AFTER INSERT OR UPDATE OR DELETE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- applications
DROP TRIGGER IF EXISTS audit_applications ON public.applications;
CREATE TRIGGER audit_applications
  AFTER INSERT OR UPDATE OR DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- clients
DROP TRIGGER IF EXISTS audit_clients ON public.clients;
CREATE TRIGGER audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- offers
DROP TRIGGER IF EXISTS audit_offers ON public.offers;
CREATE TRIGGER audit_offers
  AFTER INSERT OR UPDATE OR DELETE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- placements
DROP TRIGGER IF EXISTS audit_placements ON public.placements;
CREATE TRIGGER audit_placements
  AFTER INSERT OR UPDATE OR DELETE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS audit_placements   ON public.placements;
-- DROP TRIGGER IF EXISTS audit_offers       ON public.offers;
-- DROP TRIGGER IF EXISTS audit_clients      ON public.clients;
-- DROP TRIGGER IF EXISTS audit_applications ON public.applications;
-- DROP TRIGGER IF EXISTS audit_jobs         ON public.jobs;
-- DROP TRIGGER IF EXISTS audit_contacts     ON public.contacts;
-- DROP FUNCTION IF EXISTS public.audit_trigger_fn();
-- DROP TABLE IF EXISTS public.audit_logs;
