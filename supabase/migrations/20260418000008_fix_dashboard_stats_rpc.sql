-- =============================================================================
-- MIGRATION: 20260418000008_fix_dashboard_stats_rpc
-- PURPOSE:   Update get_dashboard_stats() to reference the renamed `jobs`
--            table instead of the old `recruitment_requests` table.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_contacts',   (SELECT count(*) FROM contacts),
    'total_employees',  (SELECT count(*) FROM employees),
    'open_requests',    (SELECT count(*) FROM jobs WHERE status = 'open'),
    'total_requests',   (SELECT count(*) FROM jobs),
    'contacts_by_department', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT cp.department, count(*) AS count
        FROM   categorized_positions cp
        WHERE  cp.department IS NOT NULL
        GROUP  BY cp.department
        ORDER  BY count DESC
        LIMIT  10
      ) t
    ),
    'contacts_by_seniority', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT cp.seniority_level, count(*) AS count
        FROM   categorized_positions cp
        WHERE  cp.seniority_level IS NOT NULL
        GROUP  BY cp.seniority_level
        ORDER  BY count DESC
      ) t
    ),
    'top_companies', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT company, count(*) AS count
        FROM   contacts
        WHERE  company IS NOT NULL AND company <> ''
        GROUP  BY company
        ORDER  BY count DESC
        LIMIT  15
      ) t
    ),
    'recent_uploads', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          ul.id,
          ul.filename,
          ul.total_rows,
          ul.new_contacts,
          ul.duplicates,
          ul.uploaded_at,
          e.full_name AS employee_name
        FROM   upload_log ul
        LEFT   JOIN employees e ON e.id = ul.employee_id
        ORDER  BY ul.uploaded_at DESC
        LIMIT  10
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- Restore the old version referencing recruitment_requests (table no longer
-- exists after migration 0005, so this is a no-op rollback path).
-- To roll back, restore the function body from baseline migration 0000.
