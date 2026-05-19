-- =============================================================================
-- MIGRATION: 20260418000017_email_integrations
-- PURPOSE:   email_templates (seeded), email_log, integrations tables.
--            Provides the persistence layer for the email framework and
--            integration registry.
-- ROLLBACK:  See DOWN section at the bottom.
-- =============================================================================

-- ── 1. email_templates ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text        NOT NULL UNIQUE,
  name           text        NOT NULL,
  subject        text        NOT NULL,
  body_html      text        NOT NULL,
  body_text      text,
  variables_json jsonb       NOT NULL DEFAULT '[]',
  is_active      boolean     NOT NULL DEFAULT true,
  updated_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_templates IS
  'Reusable email templates. Variables use {{variable_name}} syntax in subject/body_html.
   variables_json lists expected variable names as a string array.';

-- ── Seed default templates ────────────────────────────────────────────────────

INSERT INTO public.email_templates (slug, name, subject, body_html, body_text, variables_json)
VALUES

(
  'candidate_rejection',
  'Candidate Rejection',
  'Update on your application for {{job_title}} at {{company_name}}',
  '<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:24px">
<p>Dear {{candidate_name}},</p>
<p>Thank you for your interest in the <strong>{{job_title}}</strong> position at <strong>{{company_name}}</strong>.</p>
<p>After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current requirements.</p>
<p>We appreciate the time you invested in the application process and wish you all the best in your job search.</p>
<p>Best regards,<br>The {{company_name}} Recruiting Team</p>
</body></html>',
  'Dear {{candidate_name}},

Thank you for your interest in the {{job_title}} position at {{company_name}}.

After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current requirements.

We appreciate the time you invested in the application process and wish you all the best in your job search.

Best regards,
The {{company_name}} Recruiting Team',
  '["candidate_name","job_title","company_name"]'
),

(
  'interview_invitation',
  'Interview Invitation',
  'Interview Invitation: {{job_title}} — {{interview_date}}',
  '<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:24px">
<p>Dear {{candidate_name}},</p>
<p>We are pleased to invite you for a <strong>{{interview_type}}</strong> interview for the <strong>{{job_title}}</strong> role.</p>
<table style="border-collapse:collapse;margin:16px 0;width:100%">
  <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;width:140px">Date</td><td style="padding:8px">{{interview_date}}</td></tr>
  <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Time</td><td style="padding:8px">{{interview_time}}</td></tr>
  <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Format</td><td style="padding:8px">{{interview_type}}</td></tr>
  <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Interviewer</td><td style="padding:8px">{{interviewer_name}}</td></tr>
</table>
{{meeting_url}}
<p>Please confirm your attendance by replying to this email.</p>
<p>Best regards,<br>{{interviewer_name}}</p>
</body></html>',
  'Dear {{candidate_name}},

We are pleased to invite you for a {{interview_type}} interview for the {{job_title}} role.

Date: {{interview_date}}
Time: {{interview_time}}
Format: {{interview_type}}
Interviewer: {{interviewer_name}}
{{meeting_url}}

Please confirm your attendance by replying to this email.

Best regards,
{{interviewer_name}}',
  '["candidate_name","job_title","interview_date","interview_time","interview_type","meeting_url","interviewer_name"]'
),

(
  'offer_letter',
  'Offer Letter',
  'Offer of Employment: {{job_title}} at {{company_name}}',
  '<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:24px">
<p>Dear {{candidate_name}},</p>
<p>We are delighted to offer you the position of <strong>{{job_title}}</strong> at <strong>{{company_name}}</strong>.</p>
<table style="border-collapse:collapse;margin:16px 0;width:100%">
  <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;width:140px">Role</td><td style="padding:8px">{{job_title}}</td></tr>
  <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Salary</td><td style="padding:8px">{{salary}}</td></tr>
  <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Start Date</td><td style="padding:8px">{{start_date}}</td></tr>
</table>
<p>Please review this offer and let us know your decision at your earliest convenience.</p>
<p>We look forward to welcoming you to the team!</p>
<p>Best regards,<br>The {{company_name}} Recruiting Team</p>
</body></html>',
  'Dear {{candidate_name}},

We are delighted to offer you the position of {{job_title}} at {{company_name}}.

Role: {{job_title}}
Salary: {{salary}}
Start Date: {{start_date}}

Please review this offer and let us know your decision at your earliest convenience.

We look forward to welcoming you to the team!

Best regards,
The {{company_name}} Recruiting Team',
  '["candidate_name","job_title","salary","start_date","company_name"]'
),

(
  'application_received',
  'Application Received',
  'We received your application for {{job_title}}',
  '<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:24px">
<p>Dear {{candidate_name}},</p>
<p>Thank you for applying for the <strong>{{job_title}}</strong> position. We have received your application and our team will review it shortly.</p>
<p>We will be in touch if your profile matches our requirements.</p>
<p>Best regards,<br>The Recruiting Team</p>
</body></html>',
  'Dear {{candidate_name}},

Thank you for applying for the {{job_title}} position. We have received your application and our team will review it shortly.

We will be in touch if your profile matches our requirements.

Best regards,
The Recruiting Team',
  '["candidate_name","job_title"]'
)

ON CONFLICT (slug) DO NOTHING;

-- ── 2. email_log ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_log (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id          uuid        REFERENCES public.email_templates(id) ON DELETE SET NULL,
  to_email             text        NOT NULL,
  cc                   text,
  bcc                  text,
  subject              text        NOT NULL,
  body                 text        NOT NULL,
  status               text        NOT NULL DEFAULT 'queued'
    CONSTRAINT email_log_status_check
      CHECK (status IN ('queued','sent','failed','bounced')),
  error_message        text,
  related_entity_type  text,
  related_entity_id    uuid,
  sent_by              uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_log IS
  'Every email sent or attempted through the system. Immutable records.
   status: queued (no key configured) | sent | failed | bounced.
   related_entity_* links the email to a source record (application, offer, etc.).';

CREATE INDEX IF NOT EXISTS idx_email_log_status
  ON public.email_log (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_log_entity
  ON public.email_log (related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS idx_email_log_template
  ON public.email_log (template_id);

-- ── 3. integrations ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.integrations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text        NOT NULL
    CONSTRAINT integrations_provider_check
      CHECK (provider IN ('resend','google_calendar','linkedin','indeed')),
  config_json jsonb       NOT NULL DEFAULT '{}',
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_provider_unique UNIQUE (provider)
);

COMMENT ON TABLE public.integrations IS
  'Registry of external service integrations. config_json is encrypted at rest
   by Supabase. RLS restricts to admin only.';

-- ── 4. updated_at trigger for email_templates and integrations ────────────────

DROP TRIGGER IF EXISTS set_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER set_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_integrations_updated_at ON public.integrations;
CREATE TRIGGER set_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

-- email_templates: all authenticated SELECT; admin INSERT/UPDATE/DELETE
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_select_authenticated"
  ON public.email_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "email_templates_insert_admin"
  ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.user_has_role('admin'));

CREATE POLICY "email_templates_update_admin"
  ON public.email_templates FOR UPDATE TO authenticated
  USING (true) WITH CHECK (public.user_has_role('admin'));

CREATE POLICY "email_templates_delete_admin"
  ON public.email_templates FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- email_log: all authenticated SELECT/INSERT; admin UPDATE; no DELETE
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_log_select_authenticated"
  ON public.email_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "email_log_insert_authenticated"
  ON public.email_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "email_log_update_admin"
  ON public.email_log FOR UPDATE TO authenticated
  USING (true) WITH CHECK (public.user_has_role('admin'));

-- integrations: admin only (all operations)
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_select_admin"
  ON public.integrations FOR SELECT TO authenticated
  USING (public.user_has_role('admin'));

CREATE POLICY "integrations_insert_admin"
  ON public.integrations FOR INSERT TO authenticated
  WITH CHECK (public.user_has_role('admin'));

CREATE POLICY "integrations_update_admin"
  ON public.integrations FOR UPDATE TO authenticated
  USING (true) WITH CHECK (public.user_has_role('admin'));

CREATE POLICY "integrations_delete_admin"
  ON public.integrations FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));

-- ── DOWN ──────────────────────────────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS set_integrations_updated_at  ON public.integrations;
-- DROP TRIGGER IF EXISTS set_email_templates_updated_at ON public.email_templates;
-- DROP TABLE IF EXISTS public.integrations;
-- DROP TABLE IF EXISTS public.email_log;
-- DROP TABLE IF EXISTS public.email_templates;
