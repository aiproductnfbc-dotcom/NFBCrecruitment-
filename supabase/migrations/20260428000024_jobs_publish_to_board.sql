-- ============================================================================
-- Batch 7: Publish-to-Job-Board — columns, slugs, view, RLS, RPC
-- ============================================================================

-- ─── PART 1: NEW COLUMNS ─────────────────────────────────────────────────────

alter table public.jobs
  add column if not exists is_published_to_job_board boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists slug text,
  add column if not exists public_title text,
  add column if not exists public_description text,
  add column if not exists public_location text,
  -- employment_type already exists; IF NOT EXISTS skips it
  add column if not exists employment_type text,
  -- remote_policy already exists; IF NOT EXISTS skips it
  add column if not exists remote_policy text,
  add column if not exists public_salary_min numeric,
  add column if not exists public_salary_max numeric,
  add column if not exists public_salary_currency text,
  add column if not exists public_salary_visible boolean not null default false,
  add column if not exists seniority_public text,
  add column if not exists apply_deadline date;

-- ─── PART 1b: CHECK CONSTRAINTS ──────────────────────────────────────────────

-- Expand employment_type CHECK to include both internal and public values.
-- Drop-and-recreate for idempotency.
do $$
begin
  alter table public.jobs drop constraint if exists jobs_employment_type_check;
  alter table public.jobs add constraint jobs_employment_type_check
    check (
      employment_type is null
      or employment_type in (
        'full_time','part_time','contract','temp',
        'permanent','temporary','internship','executive'
      )
    );
end $$;

-- remote_policy CHECK already matches (onsite, hybrid, remote) — no change needed.
-- Re-state it idempotently so the migration is self-documenting.
do $$
begin
  alter table public.jobs drop constraint if exists jobs_remote_policy_check;
  alter table public.jobs add constraint jobs_remote_policy_check
    check (
      remote_policy is null
      or remote_policy in ('onsite','hybrid','remote')
    );
end $$;

-- Salary range coherence
do $$
begin
  alter table public.jobs drop constraint if exists jobs_salary_range_check;
  alter table public.jobs add constraint jobs_salary_range_check
    check (
      public_salary_min is null
      or public_salary_max is null
      or public_salary_min <= public_salary_max
    );
end $$;

-- ISO 4217 hint (3 uppercase letters, flexible)
do $$
begin
  alter table public.jobs drop constraint if exists jobs_salary_currency_format_check;
  alter table public.jobs add constraint jobs_salary_currency_format_check
    check (
      public_salary_currency is null
      or public_salary_currency ~ '^[A-Z]{3}$'
    );
end $$;

-- ─── PART 1c: INDEXES ────────────────────────────────────────────────────────

-- Unique slug (partial — only when slug is set)
create unique index if not exists jobs_slug_unique_idx
  on public.jobs (slug)
  where slug is not null;

-- Composite for the public_jobs view query
create index if not exists jobs_published_status_idx
  on public.jobs (is_published_to_job_board, status)
  where is_published_to_job_board = true;

-- Deadline filter
create index if not exists jobs_apply_deadline_idx
  on public.jobs (apply_deadline)
  where apply_deadline is not null;

-- ─── PART 2: SLUG GENERATION ─────────────────────────────────────────────────

create or replace function public.generate_job_slug(p_title text, p_id uuid)
returns text
language plpgsql
immutable
as $$
declare
  v_base text;
  v_hash text;
begin
  v_base := lower(coalesce(p_title, 'role'));
  v_base := translate(v_base,
    'àáâäãåčçđèéêëìíîïñòóôöõøšùúûüýÿž',
    'aaaaaaccdeeeeiiiinooooooosuuuuyyz');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  v_base := substring(v_base from 1 for 60);
  if length(v_base) = 0 then
    v_base := 'role';
  end if;
  v_hash := substring(md5(p_id::text) from 1 for 6);
  return v_base || '-' || v_hash;
end;
$$;

comment on function public.generate_job_slug is
  'Derives a URL-safe slug from a job title + job id.';

-- ─── PART 2b: PUBLISH LIFECYCLE TRIGGER ──────────────────────────────────────

create or replace function public.tg_jobs_publish_lifecycle()
returns trigger
language plpgsql
as $$
begin
  -- When publishing flips false → true, set published_at if null
  if new.is_published_to_job_board = true
     and (old is null or coalesce(old.is_published_to_job_board, false) = false)
     and new.published_at is null then
    new.published_at := now();
  end if;

  -- Always ensure slug is set when a job is being published
  if new.is_published_to_job_board = true and (new.slug is null or length(new.slug) = 0) then
    new.slug := public.generate_job_slug(coalesce(new.public_title, new.job_title), new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists tg_jobs_publish_lifecycle on public.jobs;
create trigger tg_jobs_publish_lifecycle
  before insert or update on public.jobs
  for each row execute function public.tg_jobs_publish_lifecycle();

-- ─── PART 2c: BACKFILL SLUGS ────────────────────────────────────────────────

update public.jobs
  set slug = public.generate_job_slug(coalesce(public_title, job_title), id)
  where slug is null;

-- Verify uniqueness post-backfill
do $$
declare v_dupes int;
begin
  select count(*) into v_dupes
    from (select slug, count(*) c from public.jobs where slug is not null group by slug having count(*) > 1) t;
  if v_dupes > 0 then
    raise exception 'Backfill produced duplicate slugs. Investigate.';
  end if;
end $$;

-- ─── PART 3: public_jobs VIEW ────────────────────────────────────────────────

create or replace view public.public_jobs
  with (security_invoker = true)
  as
  select
    j.id,
    j.slug,
    coalesce(j.public_title, j.job_title) as title,
    j.public_description as description,
    j.public_location as location,
    -- Translation layer: map internal employment_type values to public-facing values.
    -- Internal: full_time, part_time, contract, temp.
    -- Public:   permanent, contract, temporary, internship, executive.
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

-- ─── PART 4: RLS FOR ANON ACCESS VIA VIEW ───────────────────────────────────

-- Row-level: anon can only read published, open, non-expired rows
create policy "anon can read published open jobs"
  on public.jobs
  for select
  to anon
  using (
    is_published_to_job_board = true
    and status = 'open'
    and (apply_deadline is null or apply_deadline >= current_date)
  );

-- Column-level: revoke broad SELECT, grant only safe columns
revoke select on public.jobs from anon;
grant select (
  id, slug, job_title, public_title, public_description, public_location,
  employment_type, remote_policy, public_salary_min, public_salary_max,
  public_salary_currency, public_salary_visible, seniority_public,
  apply_deadline, published_at, created_at, status, is_published_to_job_board
) on public.jobs to anon;

-- ─── PART 5: RPC FOR JOB-BY-SLUG ────────────────────────────────────────────

create or replace function public.get_public_job_by_slug(p_slug text)
returns setof public.public_jobs
language sql
stable
security invoker
as $$
  select * from public.public_jobs where slug = p_slug limit 1;
$$;

grant execute on function public.get_public_job_by_slug(text) to anon, authenticated;
