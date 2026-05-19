-- Marketing inquiries table for public contact form submissions

create table public.marketing_inquiries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('hiring','candidate')),

  -- Common fields
  full_name text not null,
  email text not null,
  phone text,
  company text,

  -- Hiring-specific
  role_title text,
  headcount text,
  timeline text,
  industry text,

  -- Candidate-specific
  "current_role" text,
  years_experience text,
  location_preference text,
  open_to text,

  -- Common
  message text,
  consent_marketing boolean not null default false,

  -- Telemetry / metadata
  source text default 'marketing_site',
  user_agent text,
  referrer text,
  created_at timestamptz not null default now(),
  handled boolean not null default false,
  handled_at timestamptz,
  handled_by uuid references auth.users(id),
  notes text
);

comment on table public.marketing_inquiries is
  'Inbound form submissions from the public NFR marketing site.';

create index idx_marketing_inquiries_type on public.marketing_inquiries (type);
create index idx_marketing_inquiries_created_at on public.marketing_inquiries (created_at desc);
create index idx_marketing_inquiries_handled on public.marketing_inquiries (handled);

-- RLS
alter table public.marketing_inquiries enable row level security;

-- Anon: insert only, with basic validation
create policy "anon can insert marketing inquiries"
  on public.marketing_inquiries
  for insert
  to anon
  with check (
    type in ('hiring','candidate')
    and length(full_name) between 1 and 200
    and length(email) between 5 and 320
    and (message is null or length(message) <= 4000)
  );

-- Authenticated admins and recruiters can read
create policy "admins and recruiters can read marketing inquiries"
  on public.marketing_inquiries
  for select
  to authenticated
  using (
    public.user_has_role('admin')
    or public.user_has_role('recruiter')
    or public.user_has_role('account_manager')
  );

-- Authenticated admins and recruiters can update (mark handled, add notes)
create policy "admins and recruiters can update marketing inquiries"
  on public.marketing_inquiries
  for update
  to authenticated
  using (
    public.user_has_role('admin')
    or public.user_has_role('recruiter')
    or public.user_has_role('account_manager')
  )
  with check (
    public.user_has_role('admin')
    or public.user_has_role('recruiter')
    or public.user_has_role('account_manager')
  );

-- No DELETE policy — keep history
