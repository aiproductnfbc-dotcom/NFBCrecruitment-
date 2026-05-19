-- =============================================================================
-- MIGRATION: 20260415000000_baseline
-- PURPOSE:   Captures the pre-existing schema as the migration baseline.
--            This file represents the state of the database BEFORE any
--            Batch 1a changes. It is idempotent (CREATE IF NOT EXISTS).
-- ROLLBACK:  This is a baseline — rolling it back means dropping the whole db.
--            Do NOT run the down section in production.
-- =============================================================================

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  email      text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  email         text,
  company       text,
  position_raw  text,
  linkedin_url  text UNIQUE,
  connected_on  date,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  search_vector tsvector
);

CREATE TABLE IF NOT EXISTS public.categorized_positions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       uuid UNIQUE REFERENCES public.contacts(id) ON DELETE CASCADE,
  normalized_title text,
  seniority_level  text,
  department       text,
  industry         text,
  is_manual_override boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  search_vector    tsvector
);

CREATE TABLE IF NOT EXISTS public.contact_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  uploaded_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.recruitment_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title   text NOT NULL,
  department  text,
  seniority   text,
  keywords    text[],
  description text,
  status      text DEFAULT 'open',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shortlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid REFERENCES public.recruitment_requests(id) ON DELETE CASCADE,
  contact_id  uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  match_score double precision,
  status      text DEFAULT 'new',
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(request_id, contact_id)
);

CREATE TABLE IF NOT EXISTS public.title_mapping_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern          text NOT NULL,
  normalized_title text,
  seniority_level  text,
  department       text,
  priority         integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.upload_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid REFERENCES public.employees(id),
  filename     text,
  total_rows   integer,
  new_contacts integer,
  duplicates   integer,
  categorized  integer,
  uploaded_at  timestamptz DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contacts_name      ON public.contacts(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_contacts_company   ON public.contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin  ON public.contacts(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_contacts_search    ON public.contacts USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_catpos_contact     ON public.categorized_positions(contact_id);
CREATE INDEX IF NOT EXISTS idx_catpos_department  ON public.categorized_positions(department);
CREATE INDEX IF NOT EXISTS idx_catpos_seniority   ON public.categorized_positions(seniority_level);
CREATE INDEX IF NOT EXISTS idx_catpos_normalized  ON public.categorized_positions(normalized_title);
CREATE INDEX IF NOT EXISTS idx_catpos_search      ON public.categorized_positions USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_contact_sources_contact  ON public.contact_sources(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_sources_employee ON public.contact_sources(employee_id);

CREATE INDEX IF NOT EXISTS idx_recruitment_status     ON public.recruitment_requests(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_department ON public.recruitment_requests(department);

CREATE INDEX IF NOT EXISTS idx_shortlists_request ON public.shortlists(request_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_contact ON public.shortlists(contact_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_status  ON public.shortlists(status);

CREATE INDEX IF NOT EXISTS idx_mapping_rules_pattern ON public.title_mapping_rules(pattern);
CREATE INDEX IF NOT EXISTS idx_upload_log_employee   ON public.upload_log(employee_id);

-- ── RPC Functions ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_contacts',   (SELECT count(*) FROM contacts),
    'total_employees',  (SELECT count(*) FROM employees),
    'open_requests',    (SELECT count(*) FROM recruitment_requests WHERE status = 'open'),
    'total_requests',   (SELECT count(*) FROM recruitment_requests),
    'contacts_by_department', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT department, count(*) as count
        FROM categorized_positions
        WHERE department IS NOT NULL
        GROUP BY department ORDER BY count DESC
      ) t
    ),
    'contacts_by_seniority', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT seniority_level, count(*) as count
        FROM categorized_positions
        WHERE seniority_level IS NOT NULL
        GROUP BY seniority_level ORDER BY count DESC
      ) t
    ),
    'top_companies', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT company, count(*) as count
        FROM contacts
        WHERE company IS NOT NULL AND company != ''
        GROUP BY company ORDER BY count DESC LIMIT 20
      ) t
    ),
    'recent_uploads', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT ul.id, ul.filename, ul.total_rows, ul.new_contacts,
               ul.duplicates, ul.uploaded_at, e.name AS employee_name
        FROM upload_log ul
        LEFT JOIN employees e ON e.id = ul.employee_id
        ORDER BY ul.uploaded_at DESC LIMIT 10
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_candidates(
  search_title      text DEFAULT NULL,
  search_department text DEFAULT NULL,
  search_seniority  text DEFAULT NULL,
  search_keywords   text DEFAULT NULL
)
RETURNS TABLE (
  contact_id       uuid,
  first_name       text,
  last_name        text,
  email            text,
  company          text,
  position_raw     text,
  linkedin_url     text,
  normalized_title text,
  seniority_level  text,
  department       text,
  industry         text,
  match_score      double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS contact_id,
    c.first_name, c.last_name, c.email, c.company,
    c.position_raw, c.linkedin_url,
    cp.normalized_title, cp.seniority_level, cp.department, cp.industry,
    (
      CASE WHEN search_department IS NOT NULL AND cp.department ILIKE search_department THEN 30.0 ELSE 0.0 END +
      CASE WHEN search_seniority IS NOT NULL AND cp.seniority_level ILIKE search_seniority THEN 20.0 ELSE 0.0 END +
      CASE WHEN search_title IS NOT NULL AND cp.normalized_title ILIKE '%' || search_title || '%' THEN 30.0 ELSE 0.0 END +
      CASE WHEN search_title IS NOT NULL AND c.position_raw ILIKE '%' || search_title || '%' THEN 10.0 ELSE 0.0 END +
      CASE WHEN search_keywords IS NOT NULL AND c.search_vector @@ plainto_tsquery('english', search_keywords) THEN 15.0 ELSE 0.0 END +
      CASE WHEN search_keywords IS NOT NULL AND cp.search_vector @@ plainto_tsquery('english', search_keywords) THEN 15.0 ELSE 0.0 END +
      CASE WHEN search_title IS NOT NULL AND c.search_vector @@ plainto_tsquery('english', search_title) THEN 10.0 ELSE 0.0 END
    )::FLOAT AS match_score
  FROM contacts c
  LEFT JOIN categorized_positions cp ON cp.contact_id = c.id
  WHERE
    (search_department IS NULL OR cp.department ILIKE search_department)
    OR (search_seniority IS NULL OR cp.seniority_level ILIKE search_seniority)
    OR (search_title IS NOT NULL AND (
      cp.normalized_title ILIKE '%' || search_title || '%'
      OR c.position_raw ILIKE '%' || search_title || '%'
      OR c.search_vector @@ plainto_tsquery('english', search_title)
    ))
    OR (search_keywords IS NOT NULL AND (
      c.search_vector @@ plainto_tsquery('english', search_keywords)
      OR cp.search_vector @@ plainto_tsquery('english', search_keywords)
    ))
  ORDER BY match_score DESC
  LIMIT 200;
END;
$$;

-- ── Down (baseline — do not run in production) ────────────────────────────────
-- DROP TABLE IF EXISTS public.upload_log CASCADE;
-- DROP TABLE IF EXISTS public.title_mapping_rules CASCADE;
-- DROP TABLE IF EXISTS public.shortlists CASCADE;
-- DROP TABLE IF EXISTS public.recruitment_requests CASCADE;
-- DROP TABLE IF EXISTS public.contact_sources CASCADE;
-- DROP TABLE IF EXISTS public.categorized_positions CASCADE;
-- DROP TABLE IF EXISTS public.contacts CASCADE;
-- DROP TABLE IF EXISTS public.employees CASCADE;
