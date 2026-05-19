-- =============================================================================
-- MIGRATION: 20260415000002_rls_existing_tables
-- PURPOSE:   Enables Row Level Security on all tables (8 legacy + 3 auth).
--            Starter policy set:
--              • SELECT  — any authenticated user
--              • INSERT/UPDATE/DELETE — authenticated users with write roles
--                (admin, account_manager, recruiter)
--              • anon role — denied everything (no policy = no access)
-- WARNING:   DO NOT apply until the manual test plan has been run locally
--            and confirmed by the project owner.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── Helper: deny-by-default comment ──────────────────────────────────────────
-- Enabling RLS with no policies means anon/unauthed get nothing.
-- Authenticated users need explicit USING / WITH CHECK clauses.

-- =============================================================================
-- SECTION A — Legacy tables (baseline schema)
-- =============================================================================

-- ── contacts ──────────────────────────────────────────────────────────────────

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select_authenticated"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "contacts_insert_write_roles"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contacts_update_write_roles"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contacts_delete_admin"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── categorized_positions ────────────────────────────────────────────────────

ALTER TABLE public.categorized_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catpos_select_authenticated"
  ON public.categorized_positions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "catpos_insert_write_roles"
  ON public.categorized_positions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "catpos_update_write_roles"
  ON public.categorized_positions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "catpos_delete_admin"
  ON public.categorized_positions FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── employees ─────────────────────────────────────────────────────────────────

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select_authenticated"
  ON public.employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "employees_insert_admin"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

CREATE POLICY "employees_update_admin"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

CREATE POLICY "employees_delete_admin"
  ON public.employees FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── contact_sources ───────────────────────────────────────────────────────────

ALTER TABLE public.contact_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_sources_select_authenticated"
  ON public.contact_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "contact_sources_insert_write_roles"
  ON public.contact_sources FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contact_sources_delete_admin"
  ON public.contact_sources FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── recruitment_requests ──────────────────────────────────────────────────────

ALTER TABLE public.recruitment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requests_select_authenticated"
  ON public.recruitment_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "requests_insert_write_roles"
  ON public.recruitment_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "requests_update_write_roles"
  ON public.recruitment_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "requests_delete_admin"
  ON public.recruitment_requests FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── shortlists ────────────────────────────────────────────────────────────────

ALTER TABLE public.shortlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shortlists_select_authenticated"
  ON public.shortlists FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "shortlists_insert_write_roles"
  ON public.shortlists FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "shortlists_update_write_roles"
  ON public.shortlists FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "shortlists_delete_write_roles"
  ON public.shortlists FOR DELETE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

-- ── title_mapping_rules ───────────────────────────────────────────────────────

ALTER TABLE public.title_mapping_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules_select_authenticated"
  ON public.title_mapping_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rules_insert_admin"
  ON public.title_mapping_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

CREATE POLICY "rules_update_admin"
  ON public.title_mapping_rules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

CREATE POLICY "rules_delete_admin"
  ON public.title_mapping_rules FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── upload_log ────────────────────────────────────────────────────────────────

ALTER TABLE public.upload_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upload_log_select_authenticated"
  ON public.upload_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "upload_log_insert_write_roles"
  ON public.upload_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "upload_log_delete_admin"
  ON public.upload_log FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- =============================================================================
-- SECTION B — Auth tables (migration 0001)
-- =============================================================================

-- ── profiles ──────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile; admins/managers can read all
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

-- Users can update their own profile; admins can update any
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.user_has_role('admin'))
  WITH CHECK (id = auth.uid() OR public.user_has_role('admin'));

-- Only the trigger (SECURITY DEFINER) inserts profiles — no direct INSERT policy needed
-- Admins can hard-delete profiles (cascades to auth.users deletion anyway)
CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── roles ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read roles (needed for my_roles view)
CREATE POLICY "roles_select_authenticated"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can mutate roles (very rare — add new role slugs)
CREATE POLICY "roles_insert_admin"
  ON public.roles FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_role('admin'));

CREATE POLICY "roles_update_admin"
  ON public.roles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (public.user_has_role('admin'));

CREATE POLICY "roles_delete_admin"
  ON public.roles FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── user_roles ────────────────────────────────────────────────────────────────

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can see their own roles; admins can see everyone's
CREATE POLICY "user_roles_select"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.user_has_role('admin')
    OR public.user_has_role('account_manager')
  );

-- Only admins can grant / revoke roles
CREATE POLICY "user_roles_insert_admin"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_role('admin'));

CREATE POLICY "user_roles_delete_admin"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- To roll back this migration (disables RLS + drops all policies):
--
-- ALTER TABLE public.contacts            DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.categorized_positions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.employees           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.contact_sources     DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.recruitment_requests DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.shortlists          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.title_mapping_rules DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.upload_log          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles            DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.roles               DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_roles          DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "contacts_select_authenticated"   ON public.contacts;
-- DROP POLICY IF EXISTS "contacts_insert_write_roles"     ON public.contacts;
-- DROP POLICY IF EXISTS "contacts_update_write_roles"     ON public.contacts;
-- DROP POLICY IF EXISTS "contacts_delete_admin"           ON public.contacts;
-- (repeat for all policies above)
