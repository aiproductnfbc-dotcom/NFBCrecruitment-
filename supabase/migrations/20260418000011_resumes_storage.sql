-- =============================================================================
-- MIGRATION: 20260418000011_resumes_storage
-- PURPOSE:   Creates the "resumes" Supabase Storage bucket (private) and
--            attaches RLS policies to storage.objects for that bucket.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── Create bucket ─────────────────────────────────────────────────────────────
-- private (public = false), 10 MB file size limit, PDF + DOCX only

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── RLS — storage.objects (resumes bucket) ────────────────────────────────────

-- Authenticated users can read/download any resume
CREATE POLICY "resumes_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resumes');

-- Write roles can upload resumes
CREATE POLICY "resumes_insert_write_roles"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (
      public.user_has_role('admin')
      OR public.user_has_role('account_manager')
      OR public.user_has_role('recruiter')
    )
  );

-- Write roles can update resume objects (e.g. overwrite)
CREATE POLICY "resumes_update_write_roles"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'resumes')
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

-- Write roles can delete resume files
CREATE POLICY "resumes_delete_write_roles"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      public.user_has_role('admin')
      OR public.user_has_role('account_manager')
      OR public.user_has_role('recruiter')
    )
  );

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS "resumes_delete_write_roles" ON storage.objects;
-- DROP POLICY IF EXISTS "resumes_update_write_roles" ON storage.objects;
-- DROP POLICY IF EXISTS "resumes_insert_write_roles" ON storage.objects;
-- DROP POLICY IF EXISTS "resumes_select_authenticated" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'resumes';
