-- =============================================================================
-- MIGRATION: 20260418000014_reporting_rpcs
-- PURPOSE:   Read-only analytics RPC functions for the Reports page.
--            All functions are SECURITY DEFINER, return jsonb, use DB-level
--            aggregation only — no large row sets returned to the client.
-- ROLLBACK:  DROP FUNCTION statements at the bottom.
-- =============================================================================

-- ── get_overview_kpis ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_overview_kpis(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := COALESCE(p_from, date_trunc('month', now()));
  v_to   timestamptz := COALESCE(p_to, now());
BEGIN
  RETURN jsonb_build_object(
    'open_jobs',
      (SELECT COUNT(*) FROM public.jobs WHERE status = 'open'),
    'new_candidates',
      (SELECT COUNT(*) FROM public.contacts
       WHERE contact_type IN ('candidate','both')
         AND created_at BETWEEN v_from AND v_to),
    'total_submissions',
      (SELECT COUNT(*) FROM public.applications
       WHERE applied_at BETWEEN v_from AND v_to),
    'interviews_scheduled',
      (SELECT COUNT(*) FROM public.interviews
       WHERE created_at BETWEEN v_from AND v_to),
    'offers_made',
      (SELECT COUNT(*) FROM public.offers
       WHERE created_at BETWEEN v_from AND v_to),
    'hires',
      (SELECT COUNT(*) FROM public.applications
       WHERE status = 'hired'
         AND last_stage_change_at BETWEEN v_from AND v_to),
    'total_revenue',
      (SELECT COALESCE(SUM(fee_amount), 0) FROM public.placements
       WHERE created_at BETWEEN v_from AND v_to)
  );
END;
$$;

COMMENT ON FUNCTION public.get_overview_kpis IS
  'High-level KPIs for a date range. open_jobs is point-in-time (current).
   All other counts are filtered by the provided date range.';

-- ── get_recruiter_performance ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_recruiter_performance(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := COALESCE(p_from, date_trunc('month', now()));
  v_to   timestamptz := COALESCE(p_to, now());
BEGIN
  RETURN (
    WITH recruiter_subs AS (
      -- One row per application in the date range, with its recruiter
      SELECT a.id AS app_id, a.status, j.owner_id, j.opened_at
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.applied_at BETWEEN v_from AND v_to
    ),
    recruiter_stats AS (
      SELECT
        rs.owner_id,
        COUNT(*)                                            AS submissions,
        COUNT(*) FILTER (WHERE rs.status = 'hired')        AS hires
      FROM recruiter_subs rs
      GROUP BY rs.owner_id
    ),
    recruiter_ivs AS (
      SELECT rs.owner_id, COUNT(iv.id) AS interviews
      FROM recruiter_subs rs
      LEFT JOIN public.interviews iv ON iv.application_id = rs.app_id
      GROUP BY rs.owner_id
    ),
    recruiter_offers AS (
      SELECT rs.owner_id, COUNT(o.id) AS offers
      FROM recruiter_subs rs
      LEFT JOIN public.offers o ON o.application_id = rs.app_id
      GROUP BY rs.owner_id
    ),
    recruiter_revenue AS (
      SELECT
        rs.owner_id,
        COALESCE(SUM(pl.fee_amount), 0)                    AS revenue,
        ROUND(AVG(pl.start_date - rs.opened_at::date))::int AS avg_days_to_fill
      FROM recruiter_subs rs
      LEFT JOIN public.placements pl ON pl.application_id = rs.app_id
      GROUP BY rs.owner_id
    ),
    combined AS (
      SELECT
        COALESCE(s.owner_id::text, 'unassigned')  AS recruiter_id,
        COALESCE(p.full_name, 'Unassigned')        AS recruiter_name,
        s.submissions,
        COALESCE(iv.interviews, 0)                 AS interviews,
        COALESCE(o.offers,      0)                 AS offers,
        s.hires,
        COALESCE(rv.revenue,    0)                 AS revenue,
        rv.avg_days_to_fill
      FROM recruiter_stats s
      LEFT JOIN public.profiles  p  ON p.id  = s.owner_id
      LEFT JOIN recruiter_ivs    iv ON iv.owner_id = s.owner_id
      LEFT JOIN recruiter_offers o  ON o.owner_id  = s.owner_id
      LEFT JOIN recruiter_revenue rv ON rv.owner_id = s.owner_id
    )
    SELECT COALESCE(jsonb_agg(combined ORDER BY revenue DESC, hires DESC), '[]'::jsonb)
    FROM combined
  );
END;
$$;

COMMENT ON FUNCTION public.get_recruiter_performance IS
  'Per-recruiter leaderboard ranked by revenue then hires.
   Attribution: job.owner_id. Only applications applied within the date range.';

-- ── get_client_analytics ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_client_analytics(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := COALESCE(p_from, date_trunc('month', now()));
  v_to   timestamptz := COALESCE(p_to, now());
BEGIN
  RETURN (
    WITH client_jobs AS (
      SELECT j.id AS job_id, j.client_id, j.opened_at
      FROM public.jobs j
      WHERE j.client_id IS NOT NULL
        AND j.created_at BETWEEN v_from AND v_to
    ),
    client_placements AS (
      SELECT pl.job_id, pl.fee_amount, pl.start_date
      FROM public.placements pl
      JOIN client_jobs cj ON cj.job_id = pl.job_id
    ),
    client_active_apps AS (
      SELECT j.client_id, COUNT(a.id) AS active_pipeline
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.status = 'active'
        AND j.client_id IS NOT NULL
      GROUP BY j.client_id
    ),
    stats AS (
      SELECT
        c.id                                            AS client_id,
        c.name                                          AS client_name,
        COUNT(DISTINCT cj.job_id)                       AS jobs_posted,
        COUNT(DISTINCT cp.job_id)                       AS jobs_filled,
        COALESCE(SUM(cp.fee_amount), 0)                 AS total_revenue,
        ROUND(AVG(cp.start_date - cj.opened_at::date))::int AS avg_days_to_fill,
        COALESCE(ca.active_pipeline, 0)                 AS active_pipeline
      FROM public.clients c
      LEFT JOIN client_jobs         cj ON cj.client_id  = c.id
      LEFT JOIN client_placements   cp ON cp.job_id     = cj.job_id
      LEFT JOIN client_active_apps  ca ON ca.client_id  = c.id
      GROUP BY c.id, c.name, ca.active_pipeline
      HAVING COUNT(DISTINCT cj.job_id) > 0
      ORDER BY total_revenue DESC
      LIMIT 10
    )
    SELECT COALESCE(jsonb_agg(stats), '[]'::jsonb) FROM stats
  );
END;
$$;

COMMENT ON FUNCTION public.get_client_analytics IS
  'Top 10 clients by revenue, with jobs posted/filled, avg time-to-fill,
   and active pipeline count. Jobs filtered by created_at in date range.';

-- ── get_pipeline_funnel ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_pipeline_funnel(
  p_from         timestamptz DEFAULT NULL,
  p_to           timestamptz DEFAULT NULL,
  p_job_id       uuid        DEFAULT NULL,
  p_client_id    uuid        DEFAULT NULL,
  p_recruiter_id uuid        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := COALESCE(p_from, date_trunc('month', now()));
  v_to   timestamptz := COALESCE(p_to, now());
BEGIN
  RETURN (
    WITH filtered_apps AS (
      SELECT a.id, a.stage_id, a.last_stage_change_at
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.applied_at BETWEEN v_from AND v_to
        AND (p_job_id     IS NULL OR a.job_id     = p_job_id)
        AND (p_client_id  IS NULL OR j.client_id  = p_client_id)
        AND (p_recruiter_id IS NULL OR j.owner_id = p_recruiter_id)
    ),
    stage_stats AS (
      SELECT
        ps.id          AS stage_id,
        ps.name        AS stage_name,
        ps.order_index,
        ps.stage_type,
        COUNT(fa.id)   AS count,
        ROUND(
          AVG(
            EXTRACT(EPOCH FROM (now() - fa.last_stage_change_at)) / 86400.0
          )
        )::int AS avg_days_in_stage
      FROM public.pipeline_stages ps
      LEFT JOIN filtered_apps fa ON fa.stage_id = ps.id
      WHERE ps.is_active = true
      GROUP BY ps.id, ps.name, ps.order_index, ps.stage_type
    )
    SELECT COALESCE(
      jsonb_agg(stage_stats ORDER BY order_index),
      '[]'::jsonb
    )
    FROM stage_stats
  );
END;
$$;

COMMENT ON FUNCTION public.get_pipeline_funnel IS
  'Returns per-stage counts and avg days-in-stage for applications applied
   within the date range. Optional filters: job, client, recruiter.
   Conversion rates are computed in the application layer.';

-- ── get_source_effectiveness ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_source_effectiveness(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := COALESCE(p_from, date_trunc('month', now()));
  v_to   timestamptz := COALESCE(p_to, now());
BEGIN
  RETURN (
    WITH source_candidates AS (
      SELECT
        COALESCE(candidate_source, 'unknown') AS source,
        COUNT(*) AS total_candidates
      FROM public.contacts
      WHERE contact_type IN ('candidate', 'both')
        AND created_at BETWEEN v_from AND v_to
      GROUP BY candidate_source
    ),
    source_apps AS (
      SELECT
        COALESCE(c.candidate_source, 'unknown') AS source,
        COUNT(a.id)                              AS applications,
        COUNT(DISTINCT iv.application_id)        AS with_interviews,
        COUNT(a.id) FILTER (WHERE a.status = 'hired') AS hires
      FROM public.applications a
      JOIN public.contacts c ON c.id = a.contact_id
      LEFT JOIN public.interviews iv ON iv.application_id = a.id
      WHERE a.applied_at BETWEEN v_from AND v_to
      GROUP BY c.candidate_source
    ),
    combined AS (
      SELECT
        COALESCE(sc.source, sa.source)          AS source,
        COALESCE(sc.total_candidates, 0)        AS total_candidates,
        COALESCE(sa.applications, 0)            AS applications,
        COALESCE(sa.with_interviews, 0)         AS with_interviews,
        COALESCE(sa.hires, 0)                   AS hires,
        CASE
          WHEN COALESCE(sa.applications, 0) > 0
          THEN ROUND(
            COALESCE(sa.hires, 0)::numeric / sa.applications * 100, 1
          )
          ELSE 0
        END AS conversion_rate
      FROM source_candidates sc
      FULL OUTER JOIN source_apps sa USING (source)
    )
    SELECT COALESCE(
      jsonb_agg(combined ORDER BY hires DESC, applications DESC),
      '[]'::jsonb
    )
    FROM combined
  );
END;
$$;

COMMENT ON FUNCTION public.get_source_effectiveness IS
  'Source → hire funnel grouped by contacts.candidate_source.
   Contacts and applications both filtered by the date range.';

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.get_source_effectiveness;
-- DROP FUNCTION IF EXISTS public.get_pipeline_funnel;
-- DROP FUNCTION IF EXISTS public.get_client_analytics;
-- DROP FUNCTION IF EXISTS public.get_recruiter_performance;
-- DROP FUNCTION IF EXISTS public.get_overview_kpis;
