-- =============================================================================
-- MIGRATION: 20260418000007_activities_tags
-- PURPOSE:   Adds the activities (polymorphic timeline), tags, and entity_tags
--            tables. RLS + updated_at trigger on activities.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── activities ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type  text NOT NULL
    CONSTRAINT activities_subject_type_check
      CHECK (subject_type IN ('client', 'contact', 'job', 'application')),
  subject_id    uuid NOT NULL,
  -- No FK on subject_id — polymorphic. Referential integrity at app level.
  activity_type text NOT NULL
    CONSTRAINT activities_activity_type_check
      CHECK (activity_type IN (
        'note', 'call', 'email_logged', 'meeting', 'task',
        'status_change', 'stage_change', 'created', 'updated'
      )),
  title         text NOT NULL,
  body          text,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  due_at        timestamptz,
  completed_at  timestamptz,
  is_pinned     boolean NOT NULL DEFAULT false,
  -- created_by is nullable so ON DELETE SET NULL is coherent
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.activities IS
  'Polymorphic timeline events for clients, contacts, jobs, and applications.
   subject_id has no DB-level FK — enforced at the application layer.';

-- Main timeline query: ordered by recency for a given subject
CREATE INDEX IF NOT EXISTS idx_activities_subject
  ON public.activities(subject_type, subject_id, occurred_at DESC);

-- Open tasks per assignee
CREATE INDEX IF NOT EXISTS idx_activities_tasks
  ON public.activities(assignee_id, due_at)
  WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_created_by
  ON public.activities(created_by);

-- ── tags ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  color       text NOT NULL DEFAULT '#6B7280',
  entity_type text NOT NULL DEFAULT 'client'
    CONSTRAINT tags_entity_type_check
      CHECK (entity_type IN ('client', 'contact', 'job')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tags IS
  'User-defined labels that can be applied to clients, contacts, and jobs.';

-- ── entity_tags ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.entity_tags (
  tag_id      uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity_type text NOT NULL
    CONSTRAINT entity_tags_entity_type_check
      CHECK (entity_type IN ('client', 'contact', 'job')),
  entity_id   uuid NOT NULL,
  tagged_at   timestamptz NOT NULL DEFAULT now(),
  tagged_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

COMMENT ON TABLE public.entity_tags IS
  'Polymorphic many-to-many: tags applied to clients, contacts, or jobs.';

CREATE INDEX IF NOT EXISTS idx_entity_tags_entity
  ON public.entity_tags(entity_type, entity_id);

-- ── updated_at trigger on activities ─────────────────────────────────────────

DROP TRIGGER IF EXISTS set_activities_updated_at ON public.activities;
CREATE TRIGGER set_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS — activities ──────────────────────────────────────────────────────────

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_select_authenticated"
  ON public.activities FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "activities_insert_write_roles"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "activities_update_write_roles"
  ON public.activities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "activities_delete_admin"
  ON public.activities FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── RLS — tags ────────────────────────────────────────────────────────────────

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_authenticated"
  ON public.tags FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "tags_insert_write_roles"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "tags_update_write_roles"
  ON public.tags FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "tags_delete_admin"
  ON public.tags FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── RLS — entity_tags ─────────────────────────────────────────────────────────

ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_tags_select_authenticated"
  ON public.entity_tags FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "entity_tags_insert_write_roles"
  ON public.entity_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "entity_tags_delete_write_roles"
  ON public.entity_tags FOR DELETE
  TO authenticated
  USING (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.entity_tags CASCADE;
-- DROP TABLE IF EXISTS public.tags CASCADE;
-- DROP TABLE IF EXISTS public.activities CASCADE;
