-- =============================================================================
-- MIGRATION: 20260418000013_interviews_offers_placements
-- PURPOSE:   interviews, interview_participants, interview_feedback,
--            offers, placements tables + get_revenue_stats RPC.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── interviews ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interviews (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   uuid        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  round_number     int,
  scheduled_at     timestamptz NOT NULL,
  duration_minutes int         NOT NULL DEFAULT 60,
  location         text,
  meeting_url      text,
  type             text        NOT NULL DEFAULT 'video'
    CONSTRAINT interviews_type_check
      CHECK (type IN ('phone', 'video', 'onsite', 'technical', 'panel')),
  status           text        NOT NULL DEFAULT 'scheduled'
    CONSTRAINT interviews_status_check
      CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.interviews IS
  'Interview slots linked to an application. One round per row.';

CREATE INDEX IF NOT EXISTS idx_interviews_application
  ON public.interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at
  ON public.interviews(scheduled_at);

DROP TRIGGER IF EXISTS set_interviews_updated_at ON public.interviews;
CREATE TRIGGER set_interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── interview_participants ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interview_participants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id   uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  external_name  text,
  external_email text,
  role           text NOT NULL DEFAULT 'interviewer'
    CONSTRAINT interview_participants_role_check
      CHECK (role IN ('interviewer', 'observer', 'coordinator')),
  CONSTRAINT interview_participants_identity_check
    CHECK (user_id IS NOT NULL OR external_name IS NOT NULL)
);

COMMENT ON TABLE public.interview_participants IS
  'Internal users or external attendees for an interview slot.';

CREATE INDEX IF NOT EXISTS idx_interview_participants_interview
  ON public.interview_participants(interview_id);

-- ── interview_feedback ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interview_feedback (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id     uuid        NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  participant_id   uuid        REFERENCES public.interview_participants(id) ON DELETE SET NULL,
  overall_rating   int         CHECK (overall_rating BETWEEN 1 AND 5),
  recommendation   text        CHECK (recommendation IN ('strong_yes', 'yes', 'no', 'strong_no')),
  strengths        text,
  concerns         text,
  notes            text,
  submitted_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.interview_feedback IS
  'Structured feedback submitted by interview participants.';

CREATE INDEX IF NOT EXISTS idx_interview_feedback_interview
  ON public.interview_feedback(interview_id);

-- ── offers ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.offers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      uuid        NOT NULL REFERENCES public.applications(id) ON DELETE RESTRICT,
  salary              numeric,
  currency            text        NOT NULL DEFAULT 'USD',
  bonus               numeric,
  equity              text,
  start_date          date,
  offer_sent_at       timestamptz,
  offer_expires_at    timestamptz,
  status              text        NOT NULL DEFAULT 'draft'
    CONSTRAINT offers_status_check
      CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'withdrawn', 'expired')),
  decline_reason      text,
  created_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.offers IS
  'Compensation offer tied to an application. Only one active offer allowed
   per application (enforced via partial unique index below).';

-- Only one non-terminal offer per application at a time
CREATE UNIQUE INDEX IF NOT EXISTS offers_application_active_unique
  ON public.offers(application_id)
  WHERE status NOT IN ('declined', 'withdrawn', 'expired');

CREATE INDEX IF NOT EXISTS idx_offers_application
  ON public.offers(application_id);
CREATE INDEX IF NOT EXISTS idx_offers_status
  ON public.offers(status);

DROP TRIGGER IF EXISTS set_offers_updated_at ON public.offers;
CREATE TRIGGER set_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── placements ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.placements (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id           uuid        NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE RESTRICT,
  offer_id                 uuid        REFERENCES public.offers(id) ON DELETE SET NULL,
  client_id                uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  contact_id               uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  job_id                   uuid        REFERENCES public.jobs(id) ON DELETE SET NULL,
  start_date               date,
  end_date_expected        date,
  fee_amount               numeric,
  currency                 text        NOT NULL DEFAULT 'USD',
  invoice_status           text        NOT NULL DEFAULT 'pending'
    CONSTRAINT placements_invoice_status_check
      CHECK (invoice_status IN ('pending', 'invoiced', 'paid', 'disputed')),
  invoiced_at              timestamptz,
  paid_at                  timestamptz,
  guarantee_period_days    int         NOT NULL DEFAULT 90,
  guarantee_expires_at     date,
  status                   text        NOT NULL DEFAULT 'active'
    CONSTRAINT placements_status_check
      CHECK (status IN ('active', 'ended', 'replaced_under_guarantee')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.placements IS
  'One placement per hired application. Tracks fee, invoice status, guarantee.';

CREATE INDEX IF NOT EXISTS idx_placements_client
  ON public.placements(client_id);
CREATE INDEX IF NOT EXISTS idx_placements_job
  ON public.placements(job_id);
CREATE INDEX IF NOT EXISTS idx_placements_invoice_status
  ON public.placements(invoice_status);
CREATE INDEX IF NOT EXISTS idx_placements_created_at
  ON public.placements(created_at);

DROP TRIGGER IF EXISTS set_placements_updated_at ON public.placements;
CREATE TRIGGER set_placements_updated_at
  BEFORE UPDATE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── get_revenue_stats RPC ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_revenue_stats(
  p_from     timestamptz DEFAULT NULL,
  p_to       timestamptz DEFAULT NULL,
  p_group_by text        DEFAULT 'month'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH filtered AS (
    SELECT
      pl.id,
      pl.fee_amount,
      pl.invoice_status,
      pl.currency,
      pl.created_at,
      pl.client_id,
      j.owner_id,
      p_client.name    AS client_name,
      p_owner.full_name AS owner_name
    FROM public.placements pl
    LEFT JOIN public.jobs     j         ON j.id = pl.job_id
    LEFT JOIN public.clients  p_client  ON p_client.id = pl.client_id
    LEFT JOIN public.profiles p_owner   ON p_owner.id = j.owner_id
    WHERE
      (p_from IS NULL OR pl.created_at >= p_from)
      AND (p_to IS NULL OR pl.created_at <= p_to)
  ),
  totals AS (
    SELECT
      COUNT(*)::int                                                          AS placement_count,
      COALESCE(SUM(fee_amount), 0)                                           AS total_revenue,
      CASE WHEN COUNT(*) > 0
           THEN ROUND(AVG(fee_amount), 2)
           ELSE 0
      END                                                                    AS avg_fee,
      COALESCE(SUM(fee_amount) FILTER (WHERE invoice_status = 'paid'),    0) AS paid_revenue,
      COALESCE(SUM(fee_amount) FILTER (WHERE invoice_status = 'invoiced'),0) AS invoiced_revenue,
      COALESCE(SUM(fee_amount) FILTER (WHERE invoice_status = 'pending'), 0) AS pending_revenue
    FROM filtered
  ),
  grouped AS (
    SELECT
      CASE p_group_by
        WHEN 'month'     THEN to_char(created_at, 'YYYY-MM')
        WHEN 'quarter'   THEN 'Q' || EXTRACT(QUARTER FROM created_at)::text
                              || '-' || EXTRACT(YEAR FROM created_at)::text
        WHEN 'client'    THEN COALESCE(client_name, 'Unknown Client')
        WHEN 'recruiter' THEN COALESCE(owner_name,  'Unassigned')
        ELSE to_char(created_at, 'YYYY-MM')
      END                                   AS group_key,
      COUNT(*)::int                          AS count,
      COALESCE(SUM(fee_amount), 0)           AS revenue,
      COALESCE(SUM(fee_amount) FILTER (WHERE invoice_status = 'paid'), 0) AS paid
    FROM filtered
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'totals',    (SELECT row_to_json(t) FROM totals t),
    'breakdown', COALESCE((SELECT jsonb_agg(g) FROM grouped g), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_revenue_stats IS
  'Returns total revenue stats and a grouped breakdown.
   p_group_by: month | quarter | recruiter | client';

-- ── RLS — interviews ──────────────────────────────────────────────────────────

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interviews_select_authenticated"
  ON public.interviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "interviews_insert_write_roles"
  ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "interviews_update_write_roles"
  ON public.interviews FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "interviews_delete_admin"
  ON public.interviews FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ── RLS — interview_participants ──────────────────────────────────────────────

ALTER TABLE public.interview_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iparts_select_authenticated"
  ON public.interview_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "iparts_insert_write_roles"
  ON public.interview_participants FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "iparts_update_write_roles"
  ON public.interview_participants FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "iparts_delete_admin"
  ON public.interview_participants FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ── RLS — interview_feedback ──────────────────────────────────────────────────

ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ifeedback_select_authenticated"
  ON public.interview_feedback FOR SELECT TO authenticated USING (true);

CREATE POLICY "ifeedback_insert_write_roles"
  ON public.interview_feedback FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "ifeedback_update_write_roles"
  ON public.interview_feedback FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "ifeedback_delete_admin"
  ON public.interview_feedback FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ── RLS — offers ──────────────────────────────────────────────────────────────

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offers_select_authenticated"
  ON public.offers FOR SELECT TO authenticated USING (true);

CREATE POLICY "offers_insert_write_roles"
  ON public.offers FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "offers_update_write_roles"
  ON public.offers FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "offers_delete_admin"
  ON public.offers FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ── RLS — placements ──────────────────────────────────────────────────────────

ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "placements_select_authenticated"
  ON public.placements FOR SELECT TO authenticated USING (true);

CREATE POLICY "placements_insert_write_roles"
  ON public.placements FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "placements_update_write_roles"
  ON public.placements FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    public.user_has_role('admin')
    OR public.user_has_role('account_manager')
    OR public.user_has_role('recruiter')
  );

CREATE POLICY "placements_delete_admin"
  ON public.placements FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.get_revenue_stats;
-- DROP TRIGGER IF EXISTS set_placements_updated_at ON public.placements;
-- DROP TRIGGER IF EXISTS set_offers_updated_at ON public.offers;
-- DROP TRIGGER IF EXISTS set_interviews_updated_at ON public.interviews;
-- DROP TABLE IF EXISTS public.placements CASCADE;
-- DROP TABLE IF EXISTS public.offers CASCADE;
-- DROP TABLE IF EXISTS public.interview_feedback CASCADE;
-- DROP TABLE IF EXISTS public.interview_participants CASCADE;
-- DROP TABLE IF EXISTS public.interviews CASCADE;
