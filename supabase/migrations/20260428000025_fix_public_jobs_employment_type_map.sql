-- ============================================================================
-- Fix: part_time should map to 'permanent' (not 'contract') in public_jobs view
-- Reason: the public board has no part-time category; part_time roles are
-- treated as permanent positions for public display purposes.
-- ============================================================================

create or replace view public.public_jobs
  with (security_invoker = true)
  as
  select
    j.id,
    j.slug,
    coalesce(j.public_title, j.job_title) as title,
    j.public_description as description,
    j.public_location as location,
    case j.employment_type
      when 'full_time' then 'permanent'
      when 'part_time' then 'permanent'
      when 'temp'      then 'temporary'
      else j.employment_type  -- permanent, contract, temporary, internship, executive pass through
    end as employment_type,
    j.remote_policy,
    case when j.public_salary_visible then j.public_salary_min else null end as salary_min,
    case when j.public_salary_visible then j.public_salary_max else null end as salary_max,
    case when j.public_salary_visible then j.public_salary_currency else null end as salary_currency,
    j.seniority_public as seniority,
    j.apply_deadline,
    j.published_at,
    j.created_at
  from public.jobs j
  where j.is_published_to_job_board = true
    and j.status = 'open'
    and (j.apply_deadline is null or j.apply_deadline >= current_date);

comment on view public.public_jobs is
  'Public-facing, sanitized read-only view of jobs published to the public job board.';

grant select on public.public_jobs to anon, authenticated;
