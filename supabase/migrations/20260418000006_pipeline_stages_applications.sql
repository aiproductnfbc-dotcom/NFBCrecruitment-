-- =============================================================================
-- MIGRATION: 20260418000006_pipeline_stages_applications
-- PURPOSE:   Creates pipeline_stages (seeded) and applications tables.
--            Runs AFTER migration 0005 (applications references jobs).
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── pipeline_stages ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  order_index int NOT NULL,
  stage_type  text NOT NULL
    CONSTRAINT pipeline_stages_type_check
      CHECK (stage_type IN
        ('sourced', 'screened', 'submitted', 'interview', 'offer', 'hired', 'rejected')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pipeline_stages IS
  'Ordered stages in the recruitment pipeline. slug is stable for code references.';

-- Seed the 8 default stages
INSERT INTO public.pipeline_stages (name, slug, order_index, stage_type) VALUES
  ('Sourced',              'sourced',    1, 'sourced'),
  ('Screened',             'screened',   2, 'screened'),
  ('Submitted to Client',  'submitted',  3, 'submitted'),
  ('Client Interview',     'interview',  4, 'interview'),
  ('Final Interview',      'final',      5, 'interview'),
  ('Offer',                'offer',      6, 'offer'),
  ('Hired',                'hired',      7, 'hired'),
  ('Rejected',             'rejected',   8, 'rejected')
ON CONFLICT (slug) DO NOTHING;

-- ── applications ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.applications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FK named contact_id (not candidate_id) per Option B decision
  contact_id           uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  job_id               uuid NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  stage_id             int NOT NULL REFERENCES public.pipeline_stages(id),
  status               text NOT NULL DEFAULT 'active'
    CONSTRAINT applications_status_check
      CHECK (status IN ('active', 'rejected', 'withdrawn', 'hired')),
  rejection_reason     text,
  applied_at           timestamptz NOT NULL DEFAULT now(),
  source               text,
  last_stage_change_at timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applications_contact_job_unique UNIQUE (contact_id, job_id)
);

COMMENT ON TABLE public.applications IS
  'A contact (acting as candidate) applying to a specific job.
   contact_id is intentionally not named candidate_id — contacts is the
   source of truth for people (Option B decision).';

CREATE INDEX IF NOT EXISTS idx_applications_job
  ON public.applications(job_id);

CREATE INDEX IF NOT EXISTS idx_applications_stage
  ON public.applications(stage_id);

CREATE INDEX IF NOT EXISTS idx_applications_contact
  ON public.applications(contact_id);

CREATE INDEX IF NOT EXISTS idx_applications_job_stage
  ON public.applications(job_id, stage_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_applications_updated_at ON public.applications;
CREATE TRIGGER set_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Auto-promote contact_type 'lead' → 'both' on application ─────────────────

CREATE OR REPLACE FUNCTION public.promote_contact_on_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If a lead is being linked to a job, they are now also a candidate
  UPDATE public.contacts
  SET contact_type = 'both'
  WHERE id = NEW.contact_id
    AND contact_type = 'lead';
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.promote_contact_on_application IS
  'When a contact is added to an application and their contact_type is ''lead'',
   auto-upgrades them to ''both'' (lead + candidate).';

DROP TRIGGER IF EXISTS on_application_promote_contact ON public.applications;
CREATE TRIGGER on_application_promote_contact
  AFTER INSERT OR UPDATE OF contact_id ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.promote_contact_on_application();

-- ── RLS — pipeline_stages ─────────────────────────────────────────────────────

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_stages_select_authenticated"
  ON public.pipeline_stages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "pipeline_stages_insert_admin"
  ON public.pipeline_stages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

CREATE POLICY "pipeline_stages_update_admin"
  ON public.pipeline_stages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

CREATE POLICY "pipeline_stages_delete_admin"
  ON public.pipeline_stages FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── RLS — applications ────────────────────────────────────────────────────────

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_select_authenticated"
  ON public.applications FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "applications_insert_write_roles"
  ON public.applications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "applications_update_write_roles"
  ON public.applications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "applications_delete_admin"
  ON public.applications FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS on_application_promote_contact ON public.applications;
-- DROP FUNCTION IF EXISTS public.promote_contact_on_application();
-- DROP TABLE IF EXISTS public.applications CASCADE;
-- DROP TABLE IF EXISTS public.pipeline_stages CASCADE;
