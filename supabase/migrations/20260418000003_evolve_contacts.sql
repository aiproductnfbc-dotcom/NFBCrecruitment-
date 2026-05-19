-- =============================================================================
-- MIGRATION: 20260418000003_evolve_contacts
-- PURPOSE:   Adds candidate-related fields to the existing contacts table.
--            All new columns are nullable or have defaults — zero data loss.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── New columns ───────────────────────────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_type text NOT NULL DEFAULT 'lead'
    CONSTRAINT contacts_contact_type_check
      CHECK (contact_type IN ('lead', 'candidate', 'both')),

  ADD COLUMN IF NOT EXISTS candidate_status text NULL
    CONSTRAINT contacts_candidate_status_check
      CHECK (candidate_status IS NULL OR candidate_status IN
        ('active', 'do_not_contact', 'placed', 'blacklisted')),

  ADD COLUMN IF NOT EXISTS phone text NULL,

  -- current_title is distinct from position_raw (raw LinkedIn title)
  ADD COLUMN IF NOT EXISTS current_title text NULL,

  ADD COLUMN IF NOT EXISTS current_company text NULL,

  -- candidate_location: no existing location column, no collision
  ADD COLUMN IF NOT EXISTS candidate_location text NULL,

  ADD COLUMN IF NOT EXISTS willing_to_relocate boolean NULL,

  ADD COLUMN IF NOT EXISTS years_experience numeric NULL,

  ADD COLUMN IF NOT EXISTS expected_salary numeric NULL,

  ADD COLUMN IF NOT EXISTS salary_currency text NULL,

  ADD COLUMN IF NOT EXISTS notice_period_days int NULL,

  ADD COLUMN IF NOT EXISTS candidate_source text NULL
    CONSTRAINT contacts_candidate_source_check
      CHECK (candidate_source IS NULL OR candidate_source IN
        ('inbound', 'referral', 'linkedin', 'job_board', 'headhunted', 'other')),

  ADD COLUMN IF NOT EXISTS candidate_source_detail text NULL,

  ADD COLUMN IF NOT EXISTS owner_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL,

  ADD COLUMN IF NOT EXISTS gdpr_consent_at timestamptz NULL,

  ADD COLUMN IF NOT EXISTS gdpr_expires_at timestamptz NULL;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contacts_type
  ON public.contacts(contact_type);

CREATE INDEX IF NOT EXISTS idx_contacts_owner
  ON public.contacts(owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_candidate_status
  ON public.contacts(candidate_status)
  WHERE contact_type IN ('candidate', 'both');

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_contacts_candidate_status;
-- DROP INDEX IF EXISTS idx_contacts_owner;
-- DROP INDEX IF EXISTS idx_contacts_type;
-- ALTER TABLE public.contacts
--   DROP COLUMN IF EXISTS gdpr_expires_at,
--   DROP COLUMN IF EXISTS gdpr_consent_at,
--   DROP COLUMN IF EXISTS owner_id,
--   DROP COLUMN IF EXISTS candidate_source_detail,
--   DROP COLUMN IF EXISTS candidate_source,
--   DROP COLUMN IF EXISTS notice_period_days,
--   DROP COLUMN IF EXISTS salary_currency,
--   DROP COLUMN IF EXISTS expected_salary,
--   DROP COLUMN IF EXISTS years_experience,
--   DROP COLUMN IF EXISTS willing_to_relocate,
--   DROP COLUMN IF EXISTS candidate_location,
--   DROP COLUMN IF EXISTS current_company,
--   DROP COLUMN IF EXISTS current_title,
--   DROP COLUMN IF EXISTS phone,
--   DROP COLUMN IF EXISTS candidate_status,
--   DROP COLUMN IF EXISTS contact_type;
