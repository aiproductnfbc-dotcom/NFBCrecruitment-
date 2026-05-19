-- =============================================================================
-- MIGRATION: 20260418000005_rename_to_jobs
-- PURPOSE:   Extends recruitment_requests with new columns, then renames it
--            to jobs. Renames all indexes and RLS policies to match.
--            Runs AFTER migration 0004 (needs clients + client_contacts).
-- NOTE:      description and seniority columns already exist — skipped.
--            shortlists.request_id FK target updates automatically.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── Step 1: Add new nullable columns ─────────────────────────────────────────
-- (description and seniority already exist — not re-added)

ALTER TABLE public.recruitment_requests
  ADD COLUMN IF NOT EXISTS client_id uuid NULL
    REFERENCES public.clients(id) ON DELETE RESTRICT,

  ADD COLUMN IF NOT EXISTS employment_type text NULL
    CONSTRAINT recruitment_requests_employment_type_check
      CHECK (employment_type IS NULL OR employment_type IN
        ('full_time', 'part_time', 'contract', 'temp')),

  ADD COLUMN IF NOT EXISTS location text NULL,

  ADD COLUMN IF NOT EXISTS remote_policy text NULL
    CONSTRAINT recruitment_requests_remote_policy_check
      CHECK (remote_policy IS NULL OR remote_policy IN
        ('onsite', 'hybrid', 'remote')),

  ADD COLUMN IF NOT EXISTS salary_min numeric NULL,
  ADD COLUMN IF NOT EXISTS salary_max numeric NULL,
  ADD COLUMN IF NOT EXISTS salary_currency text NULL,

  ADD COLUMN IF NOT EXISTS fee_type text NULL
    CONSTRAINT recruitment_requests_fee_type_check
      CHECK (fee_type IS NULL OR fee_type IN ('percentage', 'flat')),

  ADD COLUMN IF NOT EXISTS fee_value numeric NULL,

  ADD COLUMN IF NOT EXISTS priority text NULL
    CONSTRAINT recruitment_requests_priority_check
      CHECK (priority IS NULL OR priority IN ('low', 'normal', 'high', 'urgent')),

  ADD COLUMN IF NOT EXISTS opened_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS target_close_date date NULL,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL,

  ADD COLUMN IF NOT EXISTS owner_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL,

  ADD COLUMN IF NOT EXISTS hiring_manager_contact_id uuid NULL
    REFERENCES public.client_contacts(id) ON DELETE SET NULL;

-- ── Step 2: Add updated_at trigger (missing from baseline) ───────────────────

DROP TRIGGER IF EXISTS set_recruitment_requests_updated_at ON public.recruitment_requests;
CREATE TRIGGER set_recruitment_requests_updated_at
  BEFORE UPDATE ON public.recruitment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Step 3: Rename table ──────────────────────────────────────────────────────

ALTER TABLE public.recruitment_requests RENAME TO jobs;

-- ── Step 4: Rename indexes ────────────────────────────────────────────────────
-- PK index is renamed automatically by Postgres.
-- Named indexes must be renamed explicitly.

ALTER INDEX IF EXISTS idx_recruitment_status     RENAME TO idx_jobs_status;
ALTER INDEX IF EXISTS idx_recruitment_department RENAME TO idx_jobs_department;

-- Rename the trigger to reflect the new table name
ALTER TRIGGER set_recruitment_requests_updated_at ON public.jobs
  RENAME TO set_jobs_updated_at;

-- ── Step 5: New indexes for added columns ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_jobs_client
  ON public.jobs(client_id);

CREATE INDEX IF NOT EXISTS idx_jobs_owner
  ON public.jobs(owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_priority
  ON public.jobs(priority);

-- ── Step 6: Rename constraint names on the table itself ───────────────────────
-- Postgres doesn't auto-rename CHECK constraints on table rename; do it manually.

ALTER TABLE public.jobs
  RENAME CONSTRAINT recruitment_requests_employment_type_check
    TO jobs_employment_type_check;

ALTER TABLE public.jobs
  RENAME CONSTRAINT recruitment_requests_remote_policy_check
    TO jobs_remote_policy_check;

ALTER TABLE public.jobs
  RENAME CONSTRAINT recruitment_requests_fee_type_check
    TO jobs_fee_type_check;

ALTER TABLE public.jobs
  RENAME CONSTRAINT recruitment_requests_priority_check
    TO jobs_priority_check;

-- ── Step 7: Replace RLS policies with jobs-prefixed names ────────────────────

DROP POLICY IF EXISTS "requests_select_authenticated" ON public.jobs;
DROP POLICY IF EXISTS "requests_insert_write_roles"   ON public.jobs;
DROP POLICY IF EXISTS "requests_update_write_roles"   ON public.jobs;
DROP POLICY IF EXISTS "requests_delete_admin"         ON public.jobs;

CREATE POLICY "jobs_select_authenticated"
  ON public.jobs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "jobs_insert_write_roles"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "jobs_update_write_roles"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "jobs_delete_admin"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- To roll back (run in reverse order):
--
-- DROP POLICY IF EXISTS "jobs_delete_admin"           ON public.jobs;
-- DROP POLICY IF EXISTS "jobs_update_write_roles"     ON public.jobs;
-- DROP POLICY IF EXISTS "jobs_insert_write_roles"     ON public.jobs;
-- DROP POLICY IF EXISTS "jobs_select_authenticated"   ON public.jobs;
-- (restore old policies — see migration 0002 for text)
-- DROP INDEX IF EXISTS idx_jobs_priority;
-- DROP INDEX IF EXISTS idx_jobs_owner;
-- DROP INDEX IF EXISTS idx_jobs_client;
-- ALTER INDEX IF EXISTS idx_jobs_status     RENAME TO idx_recruitment_status;
-- ALTER INDEX IF EXISTS idx_jobs_department RENAME TO idx_recruitment_department;
-- ALTER TABLE public.jobs RENAME TO recruitment_requests;
-- ALTER TABLE public.recruitment_requests DROP COLUMN IF EXISTS hiring_manager_contact_id, ...;
