-- =============================================================================
-- MIGRATION: 20260418000004_clients_client_contacts
-- PURPOSE:   Creates the clients and client_contacts tables.
--            Must run before migration 0005 (jobs table references both).
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── clients ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  legal_name         text,
  industry           text,
  website            text,
  size_bucket        text,
  country            text,
  city               text,
  address            text,
  status             text NOT NULL DEFAULT 'prospect'
    CONSTRAINT clients_status_check
      CHECK (status IN ('prospect', 'active', 'on_hold', 'churned')),
  tier               text
    CONSTRAINT clients_tier_check
      CHECK (tier IN ('A', 'B', 'C')),
  account_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source             text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz NULL
);

COMMENT ON TABLE public.clients IS
  'Companies that are clients or prospects for recruitment services.';
COMMENT ON COLUMN public.clients.deleted_at IS
  'Soft-delete: NULL = active. Filter with WHERE deleted_at IS NULL.';

CREATE INDEX IF NOT EXISTS idx_clients_status
  ON public.clients(status);

CREATE INDEX IF NOT EXISTS idx_clients_tier
  ON public.clients(tier);

CREATE INDEX IF NOT EXISTS idx_clients_account_manager
  ON public.clients(account_manager_id);

CREATE INDEX IF NOT EXISTS idx_clients_active
  ON public.clients(id)
  WHERE deleted_at IS NULL;

-- ── client_contacts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name   text NOT NULL,
  last_name    text NOT NULL,
  title        text,
  email        text,
  phone        text,
  linkedin_url text,
  is_primary   boolean NOT NULL DEFAULT false,
  status       text NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_contacts IS
  'People at client companies (hiring managers, decision makers, etc).';

CREATE INDEX IF NOT EXISTS idx_client_contacts_client
  ON public.client_contacts(client_id);

CREATE INDEX IF NOT EXISTS idx_client_contacts_primary
  ON public.client_contacts(client_id, is_primary)
  WHERE is_primary = true;

-- ── updated_at triggers ───────────────────────────────────────────────────────
-- Reuses public.set_updated_at() from migration 0001.

DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_client_contacts_updated_at ON public.client_contacts;
CREATE TRIGGER set_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_authenticated"
  ON public.clients FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "clients_insert_write_roles"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "clients_update_write_roles"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "clients_delete_admin"
  ON public.clients FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_contacts_select_authenticated"
  ON public.client_contacts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "client_contacts_insert_write_roles"
  ON public.client_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "client_contacts_update_write_roles"
  ON public.client_contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "client_contacts_delete_admin"
  ON public.client_contacts FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.client_contacts CASCADE;
-- DROP TABLE IF EXISTS public.clients CASCADE;
