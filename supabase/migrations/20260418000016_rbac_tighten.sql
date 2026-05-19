-- =============================================================================
-- MIGRATION: 20260418000016_rbac_tighten
-- PURPOSE:   Replaces broad "all write roles" policies with owner-scoped and
--            role-restricted policies on 6 core tables.
--            contacts/jobs UPDATE → owner or admin/account_manager
--            applications UPDATE → job-owner or contact-owner or admin
--            clients INSERT/UPDATE → admin/account_manager only
--            offers INSERT/UPDATE → admin/account_manager or job owner
--            placements SELECT/INSERT/UPDATE → admin/account_manager only
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── contacts ──────────────────────────────────────────────────────────────────
-- SELECT unchanged (all authenticated)
-- INSERT unchanged (any write role)
-- UPDATE: tighten to owner or admin/account_manager

DROP POLICY IF EXISTS "contacts_update_write_roles" ON public.contacts;

CREATE POLICY "contacts_update_owner_or_manager"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

-- DELETE already admin-only (unchanged)

-- ── jobs ──────────────────────────────────────────────────────────────────────
-- UPDATE: tighten to job owner or admin/account_manager

DROP POLICY IF EXISTS "requests_update_write_roles" ON public.jobs;

CREATE POLICY "jobs_update_owner_or_manager"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

-- ── applications ──────────────────────────────────────────────────────────────
-- UPDATE: job owner OR contact owner OR admin/account_manager

DROP POLICY IF EXISTS "applications_update_write_roles" ON public.applications;

CREATE POLICY "applications_update_owner_or_manager"
  ON public.applications FOR UPDATE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id AND j.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id AND j.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id AND c.owner_id = auth.uid()
    )
  );

-- ── clients ───────────────────────────────────────────────────────────────────
-- INSERT/UPDATE: restrict to admin/account_manager (drop recruiter write access)

DROP POLICY IF EXISTS "clients_insert_write_roles"  ON public.clients;
DROP POLICY IF EXISTS "clients_update_write_roles"  ON public.clients;

-- Clients table may not have had explicit policies yet (added in migration 0004 without RLS).
-- Drop by either name just in case.

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clients' AND policyname = 'clients_select_authenticated'
  ) THEN
    CREATE POLICY "clients_select_authenticated"
      ON public.clients FOR SELECT
      TO authenticated USING (true);
  END IF;
END $$;

CREATE POLICY "clients_insert_manager"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

CREATE POLICY "clients_update_manager"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clients' AND policyname = 'clients_delete_admin'
  ) THEN
    CREATE POLICY "clients_delete_admin"
      ON public.clients FOR DELETE
      TO authenticated
      USING (public.user_has_role('admin'));
  END IF;
END $$;

-- ── offers ────────────────────────────────────────────────────────────────────
-- INSERT/UPDATE: admin/account_manager OR the job's recruiter (via application→job)

DROP POLICY IF EXISTS "offers_insert_write_roles" ON public.offers;
DROP POLICY IF EXISTS "offers_update_write_roles" ON public.offers;

CREATE POLICY "offers_insert_manager_or_owner"
  ON public.offers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = application_id
        AND j.owner_id = auth.uid()
    )
  );

CREATE POLICY "offers_update_manager_or_owner"
  ON public.offers FOR UPDATE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = application_id
        AND j.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = application_id
        AND j.owner_id = auth.uid()
    )
  );

-- ── placements ────────────────────────────────────────────────────────────────
-- SELECT/INSERT/UPDATE: restrict to admin/account_manager (recruiters cannot see fee data)

DROP POLICY IF EXISTS "placements_select_authenticated"  ON public.placements;
DROP POLICY IF EXISTS "placements_insert_write_roles"    ON public.placements;
DROP POLICY IF EXISTS "placements_update_write_roles"    ON public.placements;

CREATE POLICY "placements_select_manager"
  ON public.placements FOR SELECT
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

CREATE POLICY "placements_insert_manager"
  ON public.placements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

CREATE POLICY "placements_update_manager"
  ON public.placements FOR UPDATE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  )
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

-- placements_delete_admin unchanged

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS "contacts_update_owner_or_manager"     ON public.contacts;
-- DROP POLICY IF EXISTS "jobs_update_owner_or_manager"         ON public.jobs;
-- DROP POLICY IF EXISTS "applications_update_owner_or_manager" ON public.applications;
-- DROP POLICY IF EXISTS "clients_select_authenticated"         ON public.clients;
-- DROP POLICY IF EXISTS "clients_insert_manager"               ON public.clients;
-- DROP POLICY IF EXISTS "clients_update_manager"               ON public.clients;
-- DROP POLICY IF EXISTS "clients_delete_admin"                 ON public.clients;
-- DROP POLICY IF EXISTS "offers_insert_manager_or_owner"       ON public.offers;
-- DROP POLICY IF EXISTS "offers_update_manager_or_owner"       ON public.offers;
-- DROP POLICY IF EXISTS "placements_select_manager"            ON public.placements;
-- DROP POLICY IF EXISTS "placements_insert_manager"            ON public.placements;
-- DROP POLICY IF EXISTS "placements_update_manager"            ON public.placements;
-- Then recreate the old broad policies from migration 0002 / 0006 / 0013.
