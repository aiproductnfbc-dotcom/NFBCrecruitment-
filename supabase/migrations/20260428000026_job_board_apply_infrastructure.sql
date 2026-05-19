-- ============================================================================
-- Batch 9: Public job board apply infrastructure
-- Storage bucket, policies, rate-limit table, duplicate detection,
-- applications.cv_storage_path column
-- ============================================================================

-- ── 1. Storage bucket: job-board-cvs ─────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-board-cvs',
  'job-board-cvs',
  false,
  5242880,                       -- 5 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Storage RLS policies ──────────────────────────────────────────────────

-- Anon: INSERT only, files must be under the applications/ prefix.
-- File size and mime type are already enforced by the bucket settings.
create policy "anon can upload CVs to applications/"
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'job-board-cvs'
    and (storage.foldername(name))[1] = 'applications'
  );

-- Authenticated internal staff: read access.
-- Mirrors the resumes bucket pattern using user_has_role().
create policy "internal staff can read job-board CVs"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'job-board-cvs'
    and (
      user_has_role('admin')
      or user_has_role('account_manager')
      or user_has_role('recruiter')
    )
  );

-- Admins only: delete (e.g. GDPR removal requests).
create policy "admins can delete job-board CVs"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'job-board-cvs'
    and user_has_role('admin')
  );

-- ── 3. Add cv_storage_path to applications ───────────────────────────────────
-- Stores the Storage path (e.g. 'applications/<uuid>.pdf') for public
-- job board submissions. Nullable — internal applications won't have one.

alter table public.applications
  add column if not exists cv_storage_path text;

-- ── 4. Rate-limit table ─────────────────────────────────────────────────────

create table if not exists public.public_application_rate_limit (
  id         bigserial    primary key,
  ip         text         not null,
  email      text         not null,
  job_id     uuid         references public.jobs(id) on delete cascade,
  created_at timestamptz  not null default now()
);

create index if not exists idx_rate_limit_ip_created
  on public.public_application_rate_limit (ip, created_at);
create index if not exists idx_rate_limit_email_created
  on public.public_application_rate_limit (email, created_at);
create index if not exists idx_rate_limit_job_email
  on public.public_application_rate_limit (job_id, email);

-- RLS: deny everything. The edge function uses service-role and bypasses RLS.
alter table public.public_application_rate_limit enable row level security;
-- No policies = denied for anon and authenticated.

-- Cleanup function — removes rows older than 24 hours.
-- pg_cron is NOT enabled on this project, so invoke manually or via
-- a scheduled edge function. Documented in Batch 9 summary.
create or replace function public.cleanup_application_rate_limit()
returns void
language sql
security definer
set search_path = 'public'
as $$
  delete from public.public_application_rate_limit
   where created_at < now() - interval '24 hours';
$$;

-- ── 5. Duplicate-detection helper ────────────────────────────────────────────
-- Returns true if the same email has applied for the same job within
-- the specified window (default 30 days). Called by service-role only.

create or replace function public.has_duplicate_application(
  p_email       text,
  p_job_id      uuid,
  p_window_days int default 30
)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1
      from public.applications a
      join public.contacts c on c.id = a.contact_id
     where a.job_id = p_job_id
       and lower(c.email) = lower(p_email)
       and a.applied_at > now() - (p_window_days || ' days')::interval
  );
$$;

-- Revoke from everyone including PUBLIC, then grant back to service_role only.
revoke all on function public.has_duplicate_application(text, uuid, int)
  from public, anon, authenticated;
grant execute on function public.has_duplicate_application(text, uuid, int)
  to service_role;
