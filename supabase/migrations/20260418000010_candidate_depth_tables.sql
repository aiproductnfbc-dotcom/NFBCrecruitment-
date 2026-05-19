-- =============================================================================
-- MIGRATION: 20260418000010_candidate_depth_tables
-- PURPOSE:   Adds resume storage metadata, skills, work history, and education
--            tables. Adds a search_vector maintenance trigger on contacts so
--            manually-created contacts (not via CSV upload) get indexed too.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── contact_resumes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_resumes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  -- file_url stores the Supabase Storage object path (not a signed URL)
  file_url     text NOT NULL,
  file_name    text,
  mime_type    text,
  file_size    int,
  parsed_text  text,
  is_primary   boolean NOT NULL DEFAULT false,
  uploaded_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contact_resumes IS
  'Resume files uploaded to Supabase Storage. file_url is the storage object path;
   signed URLs are generated on-demand.';

CREATE INDEX IF NOT EXISTS idx_contact_resumes_contact
  ON public.contact_resumes(contact_id);

-- ── skills ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.skills (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  category   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.skills IS
  'Canonical skill definitions. Uniqueness is case-insensitive (enforced by index).';

-- Case-insensitive unique constraint via functional index
CREATE UNIQUE INDEX IF NOT EXISTS skills_name_ci_idx
  ON public.skills(LOWER(name));

-- ── contact_skills ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_skills (
  contact_id   uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  skill_id     uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  years        numeric,
  proficiency  int CHECK (proficiency BETWEEN 1 AND 5),
  PRIMARY KEY (contact_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_skills_skill
  ON public.contact_skills(skill_id);

-- ── contact_experiences ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_experiences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  company     text,
  title       text,
  start_date  date,
  end_date    date,
  is_current  boolean NOT NULL DEFAULT false,
  description text,
  location    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_experiences_contact
  ON public.contact_experiences(contact_id);

DROP TRIGGER IF EXISTS set_contact_experiences_updated_at ON public.contact_experiences;
CREATE TRIGGER set_contact_experiences_updated_at
  BEFORE UPDATE ON public.contact_experiences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── contact_education ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_education (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  institution text,
  degree      text,
  field       text,
  start_year  int,
  end_year    int,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_education_contact
  ON public.contact_education(contact_id);

DROP TRIGGER IF EXISTS set_contact_education_updated_at ON public.contact_education;
CREATE TRIGGER set_contact_education_updated_at
  BEFORE UPDATE ON public.contact_education
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── contacts.search_vector maintenance trigger ────────────────────────────────
-- The search_vector column already exists (baseline) and is populated by the
-- CSV upload process for existing contacts. This trigger ensures that:
--   a) Manually-created contacts are indexed immediately on INSERT.
--   b) Any contact update (including Batch 1b candidate fields) refreshes the index.
-- Existing rows are NOT retroactively updated — their upload-set search_vector
-- remains valid until their row is next written.

CREATE OR REPLACE FUNCTION public.set_contacts_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.first_name,       '') || ' ' ||
    coalesce(NEW.last_name,        '') || ' ' ||
    coalesce(NEW.email,            '') || ' ' ||
    coalesce(NEW.company,          '') || ' ' ||
    coalesce(NEW.position_raw,     '') || ' ' ||
    coalesce(NEW.current_title,    '') || ' ' ||
    coalesce(NEW.current_company,  '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_contacts_search_vector_trigger ON public.contacts;
CREATE TRIGGER set_contacts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_contacts_search_vector();

-- ── RLS — contact_resumes ─────────────────────────────────────────────────────

ALTER TABLE public.contact_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_resumes_select_authenticated"
  ON public.contact_resumes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "contact_resumes_insert_write_roles"
  ON public.contact_resumes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contact_resumes_update_write_roles"
  ON public.contact_resumes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contact_resumes_delete_write_roles"
  ON public.contact_resumes FOR DELETE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

-- ── RLS — skills ──────────────────────────────────────────────────────────────

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skills_select_authenticated"
  ON public.skills FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "skills_insert_write_roles"
  ON public.skills FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "skills_update_admin"
  ON public.skills FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (public.user_has_role('admin'));

CREATE POLICY "skills_delete_admin"
  ON public.skills FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── RLS — contact_skills ──────────────────────────────────────────────────────

ALTER TABLE public.contact_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_skills_select_authenticated"
  ON public.contact_skills FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "contact_skills_insert_write_roles"
  ON public.contact_skills FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contact_skills_update_write_roles"
  ON public.contact_skills FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contact_skills_delete_write_roles"
  ON public.contact_skills FOR DELETE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

-- ── RLS — contact_experiences ─────────────────────────────────────────────────

ALTER TABLE public.contact_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_experiences_select_authenticated"
  ON public.contact_experiences FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "contact_experiences_insert_write_roles"
  ON public.contact_experiences FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contact_experiences_update_write_roles"
  ON public.contact_experiences FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contact_experiences_delete_write_roles"
  ON public.contact_experiences FOR DELETE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

-- ── RLS — contact_education ───────────────────────────────────────────────────

ALTER TABLE public.contact_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_education_select_authenticated"
  ON public.contact_education FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "contact_education_insert_write_roles"
  ON public.contact_education FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contact_education_update_write_roles"
  ON public.contact_education FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "contact_education_delete_write_roles"
  ON public.contact_education FOR DELETE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS set_contacts_search_vector_trigger ON public.contacts;
-- DROP FUNCTION IF EXISTS public.set_contacts_search_vector();
-- DROP TABLE IF EXISTS public.contact_education CASCADE;
-- DROP TABLE IF EXISTS public.contact_experiences CASCADE;
-- DROP TABLE IF EXISTS public.contact_skills CASCADE;
-- DROP TABLE IF EXISTS public.skills CASCADE;
-- DROP TABLE IF EXISTS public.contact_resumes CASCADE;
