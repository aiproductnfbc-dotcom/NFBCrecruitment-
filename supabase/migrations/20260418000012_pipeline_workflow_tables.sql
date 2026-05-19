-- =============================================================================
-- MIGRATION: 20260418000012_pipeline_workflow_tables
-- PURPOSE:   Adds application_stage_history (append-only audit) and
--            application_scorecards (one per reviewer per application).
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── application_stage_history ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.application_stage_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  from_stage_id  int         REFERENCES public.pipeline_stages(id),      -- NULL on initial placement
  to_stage_id    int         NOT NULL REFERENCES public.pipeline_stages(id),
  moved_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason         text,
  moved_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.application_stage_history IS
  'Append-only audit trail of every pipeline stage transition.
   from_stage_id is NULL when recording the initial placement.
   Never update or delete rows from this table.';

CREATE INDEX IF NOT EXISTS idx_ash_application
  ON public.application_stage_history(application_id);

CREATE INDEX IF NOT EXISTS idx_ash_moved_at
  ON public.application_stage_history(moved_at);

-- ── application_scorecards ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.application_scorecards (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      uuid        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  reviewer_id         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  technical_score     smallint    CHECK (technical_score     BETWEEN 1 AND 5),
  culture_score       smallint    CHECK (culture_score       BETWEEN 1 AND 5),
  communication_score smallint    CHECK (communication_score BETWEEN 1 AND 5),
  overall_score       smallint    CHECK (overall_score       BETWEEN 1 AND 5),
  recommendation      text        CHECK (recommendation IN ('strong_yes', 'yes', 'no', 'strong_no')),
  notes               text,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, reviewer_id)
);

COMMENT ON TABLE public.application_scorecards IS
  'One scorecard per reviewer per application. Upserted on re-submit.
   reviewer_id SET NULL on profile delete so the scorecard data is preserved.';

CREATE INDEX IF NOT EXISTS idx_scorecards_application
  ON public.application_scorecards(application_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_application_scorecards_updated_at ON public.application_scorecards;
CREATE TRIGGER set_application_scorecards_updated_at
  BEFORE UPDATE ON public.application_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS — application_stage_history ─────────────────────────────────────────

ALTER TABLE public.application_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ash_select_authenticated"
  ON public.application_stage_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "ash_insert_write_roles"
  ON public.application_stage_history FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

-- No UPDATE/DELETE — this is an append-only audit table.

-- ── RLS — application_scorecards ─────────────────────────────────────────────

ALTER TABLE public.application_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scorecards_select_authenticated"
  ON public.application_scorecards FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "scorecards_insert_write_roles"
  ON public.application_scorecards FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "scorecards_update_own_or_admin"
  ON public.application_scorecards FOR UPDATE
  TO authenticated
  USING (
    reviewer_id = auth.uid()
    OR public.user_has_role('admin')
  )
  WITH CHECK (
    reviewer_id = auth.uid()
    OR public.user_has_role('admin')
  );

CREATE POLICY "scorecards_delete_admin"
  ON public.application_scorecards FOR DELETE
  TO authenticated
  USING (public.user_has_role('admin'));

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS set_application_scorecards_updated_at ON public.application_scorecards;
-- DROP TABLE IF EXISTS public.application_scorecards CASCADE;
-- DROP TABLE IF EXISTS public.application_stage_history CASCADE;
