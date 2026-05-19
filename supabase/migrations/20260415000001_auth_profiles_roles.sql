-- =============================================================================
-- MIGRATION: 20260415000001_auth_profiles_roles
-- PURPOSE:   Adds profiles, roles, user_roles tables and the
--            auth.user_has_role() helper. Wires a trigger so every new
--            auth.users row automatically gets a profiles row.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── 1. profiles ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  avatar_url  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'One row per authenticated user. Mirrors auth.users with ATS-specific fields.';

-- ── 2. roles (seed inline so migration is self-contained) ─────────────────────

CREATE TABLE IF NOT EXISTS public.roles (
  id   serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL
);

INSERT INTO public.roles (slug, name) VALUES
  ('admin',           'Administrator'),
  ('account_manager', 'Account Manager'),
  ('recruiter',       'Recruiter'),
  ('viewer',          'Viewer')
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE public.roles IS
  'Available roles in the system. Extend here as needed.';

-- ── 3. user_roles ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id    integer NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES public.profiles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);

COMMENT ON TABLE public.user_roles IS
  'Many-to-many: which roles each user holds. granted_by records who assigned it.';

-- ── 4. public.user_has_role() helper ─────────────────────────────────────────
-- Used inside RLS policies. Returns true if the calling user holds the given role.
-- Lives in public schema (auth schema is locked in managed Supabase).

CREATE OR REPLACE FUNCTION public.user_has_role(role_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.slug = role_slug
  );
$$;

COMMENT ON FUNCTION public.user_has_role IS
  'Returns true if the currently authenticated user holds the given role slug.
   Example: public.user_has_role(''admin'')
   Used inside RLS policies — runs with SECURITY DEFINER so callers cannot
   bypass it by switching search_path.';

-- ── 5. Convenience view: my_roles ─────────────────────────────────────────────

CREATE OR REPLACE VIEW public.my_roles AS
  SELECT r.slug, r.name
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid();

COMMENT ON VIEW public.my_roles IS
  'Returns the roles of the currently authenticated user. Safe to expose to anon.';

-- ── 6. Auto-create profile on signup ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop and recreate to ensure idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user IS
  'Trigger function: auto-inserts a profiles row for every new auth.users row.
   Runs SECURITY DEFINER so it has write access to profiles even under RLS.';

-- ── 7. updated_at auto-bump for profiles ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- To roll back this migration:
--
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
-- DROP FUNCTION IF EXISTS public.handle_new_auth_user();
-- DROP FUNCTION IF EXISTS public.set_updated_at();
-- DROP FUNCTION IF EXISTS public.user_has_role(text);
-- DROP VIEW  IF EXISTS public.my_roles;
-- DROP TABLE IF EXISTS public.user_roles CASCADE;
-- DROP TABLE IF EXISTS public.roles CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
