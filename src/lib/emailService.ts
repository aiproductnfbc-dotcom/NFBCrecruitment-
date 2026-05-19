import { supabase } from './supabaseClient'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  id:             string
  slug:           string
  name:           string
  subject:        string
  body_html:      string
  body_text:      string | null
  variables_json: string[]
  is_active:      boolean
  updated_by:     string | null
  updated_at:     string
}

export type EmailLogStatus = 'queued' | 'sent' | 'failed' | 'bounced'

export interface EmailLogEntry {
  id:                  string
  template_id:         string | null
  to_email:            string
  cc:                  string | null
  bcc:                 string | null
  subject:             string
  body:                string
  status:              EmailLogStatus
  error_message:       string | null
  related_entity_type: string | null
  related_entity_id:   string | null
  sent_by:             string | null
  sent_at:             string | null
  created_at:          string
  template?:           { slug: string; name: string } | null
  sender?:             { full_name: string | null; email: string } | null
}

export interface SendEmailOptions {
  cc?:                  string
  bcc?:                 string
  bodyText?:            string
  templateId?:          string
  relatedEntityType?:   string
  relatedEntityId?:     string
}

// ── Template rendering ─────────────────────────────────────────────────────────

function replace(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export async function renderTemplate(
  slug: string,
  variables: Record<string, string>
): Promise<{ subject: string; bodyHtml: string; bodyText: string; template: EmailTemplate }> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  if (error) throw new Error(`Template "${slug}" not found: ${error.message}`)

  const tpl = data as EmailTemplate
  return {
    subject:  replace(tpl.subject,   variables),
    bodyHtml: replace(tpl.body_html, variables),
    bodyText: tpl.body_text ? replace(tpl.body_text, variables) : replace(tpl.subject, variables),
    template: tpl,
  }
}

// ── Send email via Edge Function ───────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  options: SendEmailOptions = {}
): Promise<{ success: boolean; emailLogId: string | null; queued: boolean }> {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      to,
      subject,
      body_html:            bodyHtml,
      body_text:            options.bodyText            ?? undefined,
      cc:                   options.cc                  ?? undefined,
      bcc:                  options.bcc                 ?? undefined,
      template_id:          options.templateId          ?? undefined,
      related_entity_type:  options.relatedEntityType   ?? undefined,
      related_entity_id:    options.relatedEntityId     ?? undefined,
    },
  })

  if (error) throw new Error(`sendEmail failed: ${error.message}`)

  const result = data as { success: boolean; email_log_id: string | null; queued: boolean }
  return {
    success:    result.success,
    emailLogId: result.email_log_id,
    queued:     result.queued ?? false,
  }
}

// ── Send templated email (render + send in one call) ──────────────────────────

export async function sendTemplatedEmail(
  slug: string,
  variables: Record<string, string>,
  to: string,
  options: Omit<SendEmailOptions, 'templateId'> = {}
): Promise<{ success: boolean; emailLogId: string | null; queued: boolean }> {
  const rendered = await renderTemplate(slug, variables)
  return sendEmail(to, rendered.subject, rendered.bodyHtml, {
    ...options,
    bodyText:   rendered.bodyText,
    templateId: rendered.template.id,
  })
}

// ── Email log queries ──────────────────────────────────────────────────────────

export interface EmailLogFilters {
  status?:             EmailLogStatus
  relatedEntityType?:  string
  sentBy?:             string
  from?:               string
  to?:                 string
}

export async function getEmailLog(
  filters: EmailLogFilters = {},
  limit = 100
): Promise<EmailLogEntry[]> {
  let q = supabase
    .from('email_log')
    .select(`
      id, template_id, to_email, cc, bcc, subject, body,
      status, error_message,
      related_entity_type, related_entity_id,
      sent_by, sent_at, created_at,
      template:email_templates!template_id(slug, name),
      sender:profiles!sent_by(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters.status)            q = q.eq('status', filters.status)
  if (filters.relatedEntityType) q = q.eq('related_entity_type', filters.relatedEntityType)
  if (filters.sentBy)            q = q.eq('sent_by', filters.sentBy)
  if (filters.from)              q = q.gte('created_at', filters.from)
  if (filters.to)                q = q.lte('created_at', filters.to)

  const { data, error } = await q
  if (error) throw new Error(`getEmailLog failed: ${error.message}`)
  return (data ?? []) as unknown as EmailLogEntry[]
}

// ── Template CRUD (admin) ─────────────────────────────────────────────────────

export async function listTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('id, slug, name, subject, body_html, body_text, variables_json, is_active, updated_by, updated_at')
    .order('name')
  if (error) throw new Error(`listTemplates failed: ${error.message}`)
  return (data ?? []) as EmailTemplate[]
}

export async function getTemplate(id: string): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(`getTemplate failed: ${error.message}`)
  return data as EmailTemplate
}

export async function updateTemplate(
  id: string,
  updates: Partial<Pick<EmailTemplate, 'subject' | 'body_html' | 'body_text' | 'name' | 'is_active'>>
): Promise<EmailTemplate> {
  const actorId = (await supabase.auth.getUser()).data.user?.id
  const { data, error } = await supabase
    .from('email_templates')
    .update({ ...updates, updated_by: actorId })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`updateTemplate failed: ${error.message}`)
  return data as EmailTemplate
}
