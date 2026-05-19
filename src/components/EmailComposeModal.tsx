import { useState, useEffect } from 'react'
import {
  X, Send, Eye, EyeOff, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, Mail, FileText, AlertCircle,
} from 'lucide-react'
import {
  listTemplates, renderTemplate, sendEmail,
  type EmailTemplate,
} from '../lib/emailService'
import { useAuth } from '../context/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactMeta {
  id:               string
  first_name:       string
  last_name:        string
  email:            string | null
  current_company?: string | null
  company?:         string | null
}

interface Props {
  contact: ContactMeta
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wrap plain text in a minimal HTML email shell for the edge function. */
function wrapPlainText(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px 20px;color:#374151;line-height:1.65;font-size:14px"><p style="white-space:pre-wrap;margin:0">${esc}</p></div>`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmailComposeModal({ contact, onClose }: Props) {
  const { profile } = useAuth()

  // ── Mode ─────────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'template' | 'custom'>('template')

  // ── Templates ────────────────────────────────────────────────────────────────
  const [templates,        setTemplates]        = useState<EmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedSlug,     setSelectedSlug]     = useState('')
  const [varValues,        setVarValues]        = useState<Record<string, string>>({})

  // ── Custom mode ───────────────────────────────────────────────────────────────
  const [customSubject, setCustomSubject] = useState('')
  const [customBody,    setCustomBody]    = useState('')

  // ── CC / BCC ──────────────────────────────────────────────────────────────────
  const [cc,        setCc]        = useState('')
  const [bcc,       setBcc]       = useState('')
  const [showCcBcc, setShowCcBcc] = useState(false)

  // ── Preview ───────────────────────────────────────────────────────────────────
  const [preview,    setPreview]    = useState<{ subject: string; bodyHtml: string } | null>(null)
  const [showHtml,   setShowHtml]   = useState(false)
  const [previewing, setPreviewing] = useState(false)

  // ── Send state ────────────────────────────────────────────────────────────────
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // ── Load templates on mount ───────────────────────────────────────────────────
  useEffect(() => {
    listTemplates()
      .then(ts => {
        const active = ts.filter(t => t.is_active)
        setTemplates(active)
        if (active.length > 0) setSelectedSlug(active[0].slug)
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false))
  }, [])

  // ── Auto-fill known variables when template changes ───────────────────────────
  const selectedTemplate = templates.find(t => t.slug === selectedSlug) ?? null

  useEffect(() => {
    if (!selectedTemplate) return
    const autoFill: Record<string, string> = {
      candidate_name: `${contact.first_name} ${contact.last_name}`.trim(),
      first_name:     contact.first_name,
      last_name:      contact.last_name,
      recruiter_name: profile?.full_name ?? '',
      company_name:   contact.current_company ?? contact.company ?? '',
    }
    const init: Record<string, string> = {}
    for (const v of selectedTemplate.variables_json) {
      init[v] = autoFill[v] ?? ''
    }
    setVarValues(init)
    setPreview(null)
  }, [selectedSlug]) // intentionally only on slug change

  // ── Preview ───────────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!selectedTemplate) return
    setPreviewing(true)
    setError(null)
    try {
      const rendered = await renderTemplate(selectedSlug, varValues)
      setPreview({ subject: rendered.subject, bodyHtml: rendered.bodyHtml })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPreviewing(false)
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!contact.email) return
    setSending(true)
    setError(null)
    try {
      let subject    = ''
      let bodyHtml   = ''
      let templateId: string | undefined

      if (mode === 'template') {
        // Render if not yet previewed
        const rendered = preview
          ? { subject: preview.subject, bodyHtml: preview.bodyHtml, template: selectedTemplate! }
          : await renderTemplate(selectedSlug, varValues)
        subject    = rendered.subject
        bodyHtml   = rendered.bodyHtml
        templateId = selectedTemplate?.id
      } else {
        subject  = customSubject.trim()
        bodyHtml = wrapPlainText(customBody)
      }

      await sendEmail(contact.email, subject, bodyHtml, {
        cc:                  cc  || undefined,
        bcc:                 bcc || undefined,
        templateId,
        relatedEntityType:   'contacts',
        relatedEntityId:     contact.id,
      })
      setSent(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const canSend = mode === 'template'
    ? !!selectedSlug && !!contact.email
    : !!customSubject.trim() && !!customBody.trim() && !!contact.email

  // ── No email address ──────────────────────────────────────────────────────────
  if (!contact.email) {
    return (
      <Backdrop onClose={onClose}>
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center space-y-4">
          <Mail size={36} className="text-gray-200 mx-auto" />
          <h3 className="font-semibold text-gray-900">No email address</h3>
          <p className="text-sm text-gray-500">
            Add an email address to this contact before sending an email.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            Close
          </button>
        </div>
      </Backdrop>
    )
  }

  // ── Sent confirmation ─────────────────────────────────────────────────────────
  if (sent) {
    return (
      <Backdrop onClose={onClose}>
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center space-y-4">
          <CheckCircle2 size={44} className="text-green-500 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-900">Email sent!</h3>
          <p className="text-sm text-gray-500">
            Your message to <strong>{contact.email}</strong> was delivered successfully.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </Backdrop>
    )
  }

  // ── Compose modal ─────────────────────────────────────────────────────────────
  return (
    <Backdrop onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Mail size={16} className="text-primary" /> Send Email
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              To: <span className="font-medium text-gray-600">{contact.first_name} {contact.last_name}</span>
              {' '}·{' '}
              <span className="font-mono">{contact.email}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['template', 'custom'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setPreview(null); setError(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  mode === m
                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'template' ? <FileText size={13} /> : <Mail size={13} />}
                {m === 'template' ? 'Use Template' : 'Write Email'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">

          {mode === 'template' ? (
            <>
              {/* Template selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Template</label>
                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" /> Loading…
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    No active templates. Create one in <strong>Admin → Templates</strong>.
                  </div>
                ) : (
                  <select
                    value={selectedSlug}
                    onChange={e => { setSelectedSlug(e.target.value); setPreview(null) }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {templates.map(t => (
                      <option key={t.slug} value={t.slug}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Variable fields */}
              {selectedTemplate && selectedTemplate.variables_json.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Fill in variables
                    <span className="ml-1.5 text-gray-400 font-normal">
                      — known fields are pre-filled; edit anything as needed
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTemplate.variables_json.map(v => (
                      <div key={v}>
                        <label className="block text-xs text-gray-400 mb-1 font-mono">{`{{${v}}}`}</label>
                        <input
                          value={varValues[v] ?? ''}
                          onChange={e => {
                            setVarValues(prev => ({ ...prev, [v]: e.target.value }))
                            setPreview(null)
                          }}
                          placeholder={v.replace(/_/g, ' ')}
                          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview panel */}
              {preview && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">Subject</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{preview.subject}</p>
                    </div>
                    <button
                      onClick={() => setShowHtml(v => !v)}
                      className="shrink-0 ml-3 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                      {showHtml ? <EyeOff size={11} /> : <Eye size={11} />}
                      {showHtml ? 'Hide HTML' : 'View HTML'}
                    </button>
                  </div>
                  {showHtml ? (
                    <pre className="p-4 text-xs font-mono text-gray-600 bg-white overflow-auto max-h-52 whitespace-pre-wrap">
                      {preview.bodyHtml}
                    </pre>
                  ) : (
                    <div
                      className="p-4 bg-white max-h-52 overflow-auto text-sm"
                      dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                    />
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Custom email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Subject</label>
                <input
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  placeholder="Email subject…"
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Message</label>
                <textarea
                  value={customBody}
                  onChange={e => setCustomBody(e.target.value)}
                  placeholder={`Hi ${contact.first_name},\n\n`}
                  rows={12}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </>
          )}

          {/* CC / BCC */}
          <div>
            <button
              onClick={() => setShowCcBcc(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              {showCcBcc ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Add CC / BCC
            </button>
            {showCcBcc && (
              <div className="mt-2 space-y-2">
                {([['CC', cc, setCc], ['BCC', bcc, setBcc]] as const).map(([label, val, set]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-8 shrink-0">{label}</span>
                    <input
                      value={val}
                      onChange={e => set(e.target.value)}
                      placeholder={`${label.toLowerCase()}@example.com`}
                      className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {/* Preview button for template mode (before send) */}
            {mode === 'template' && selectedTemplate && (
              <button
                onClick={handlePreview}
                disabled={previewing || !selectedSlug}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {previewing
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Eye size={13} />
                }
                {preview ? 'Re-preview' : 'Preview'}
              </button>
            )}

            <button
              onClick={handleSend}
              disabled={sending || !canSend}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {sending
                ? <Loader2 size={13} className="animate-spin" />
                : <Send size={13} />
              }
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </Backdrop>
  )
}

// ─── Backdrop ─────────────────────────────────────────────────────────────────

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}
