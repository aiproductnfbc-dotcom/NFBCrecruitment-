import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Save, X, Loader2, AlertCircle,
  MapPin, DollarSign, Briefcase, Users,
  Clock, ChevronRight, Star, XCircle, Calendar, Plus, Download,
  Video, Phone, Monitor, Users2, Layers, MessageSquare, CheckCircle2,
  Globe, ExternalLink,
} from 'lucide-react'
import Badge from '../components/Badge'
import ActivityTimeline from '../components/ActivityTimeline'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { getJobById, updateJob, getPublicJobUrl, type Job } from '../lib/jobService'
import {
  getJobPipeline, moveApplicationStage, rejectApplication,
  getJobPipelineMetrics, getScorecardsForApplication,
  type KanbanColumn, type KanbanCard, type PipelineMetrics, type Scorecard,
} from '../lib/pipelineService'
import {
  getInterviewsForJob, scheduleInterview, updateInterviewStatus, downloadICS,
  submitFeedback,
  type InterviewWithContext, type InterviewType, type InterviewStatus, type FeedbackRec,
} from '../lib/interviewService'
import { sendTemplatedEmail } from '../lib/emailService'

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Pipeline', 'Interviews', 'Scorecards', 'Activity', 'Publish'] as const
type Tab = typeof TABS[number]

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'temp'] as const
const REMOTE_POLICIES = ['onsite', 'hybrid', 'remote'] as const
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
const CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'IQD']
const SENIORITY_LEVELS = ['Intern','Junior','Mid','Senior','Lead','Manager','Director','VP','C-Suite']
const DEPARTMENTS = [
  'Architecture','Consulting','Data','Design','Education','Energy',
  'Engineering','Executive','Finance','Healthcare','Hospitality',
  'HR','Legal','Marketing','Operations','Product','Real Estate','Sales','Other',
]

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  strong_yes: { label: 'Strong Yes', color: 'text-green-700 bg-green-50' },
  yes:        { label: 'Yes',        color: 'text-blue-700 bg-blue-50'   },
  no:         { label: 'No',         color: 'text-orange-700 bg-orange-50' },
  strong_no:  { label: 'Strong No',  color: 'text-red-700 bg-red-50'     },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, currency = 'USD') {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function relDate(iso: string | null) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ job, onUpdated }: { job: Job; onUpdated: (j: Job) => void }) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<Job>>({})

  const startEdit = () => {
    setDraft({
      job_title:    job.job_title,
      department:   job.department,
      seniority:    job.seniority,
      description:  job.description,
      employment_type: job.employment_type,
      location:     job.location,
      remote_policy: job.remote_policy,
      salary_min:   job.salary_min,
      salary_max:   job.salary_max,
      salary_currency: job.salary_currency ?? 'USD',
      fee_type:     job.fee_type,
      fee_value:    job.fee_value,
      priority:     job.priority,
      target_close_date: job.target_close_date,
      status:       job.status,
    })
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateJob(job.id, draft)
      onUpdated(updated)
      setEditing(false)
      toast('Job updated', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof Job, v: unknown) => setDraft(p => ({ ...p, [k]: v || null }))

  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Pencil size={14} /> Edit
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section label="Job Details">
            <Row label="Title">{job.job_title}</Row>
            <Row label="Department"><Badge value={job.department} variant="department" /></Row>
            <Row label="Seniority"><Badge value={job.seniority} variant="seniority" /></Row>
            <Row label="Status"><Badge value={job.status} variant="status" /></Row>
            <Row label="Priority">{job.priority ? <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${job.priority === 'urgent' ? 'bg-red-100 text-red-700' : job.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{job.priority}</span> : '—'}</Row>
          </Section>

          <Section label="Location & Type">
            <Row label="Location">{job.location ?? '—'}</Row>
            <Row label="Remote">{job.remote_policy ?? '—'}</Row>
            <Row label="Employment">{job.employment_type?.replace('_', ' ') ?? '—'}</Row>
          </Section>

          <Section label="Compensation">
            <Row label="Salary">{job.salary_min || job.salary_max ? `${fmt(job.salary_min, job.salary_currency ?? 'USD')} – ${fmt(job.salary_max, job.salary_currency ?? 'USD')}` : '—'}</Row>
            <Row label="Fee">{job.fee_type && job.fee_value != null ? `${job.fee_value}${job.fee_type === 'percentage' ? '%' : ` ${job.salary_currency ?? 'USD'}`}` : '—'}</Row>
          </Section>

          <Section label="Dates">
            <Row label="Opened">{job.opened_at ? new Date(job.opened_at).toLocaleDateString() : relDate(job.created_at)}</Row>
            <Row label="Target Close">{job.target_close_date ?? '—'}</Row>
            <Row label="Closed">{job.closed_at ? new Date(job.closed_at).toLocaleDateString() : '—'}</Row>
          </Section>
        </div>

        {job.description && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
          </div>
        )}
      </div>
    )
  }

  // Edit mode
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Job Title *">
          <input value={draft.job_title ?? ''} onChange={e => set('job_title', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </Field>
        <Field label="Status">
          <select value={draft.status ?? 'open'} onChange={e => set('status', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="open">Open</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Closed</option>
          </select>
        </Field>
        <Field label="Department">
          <select value={draft.department ?? ''} onChange={e => set('department', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">—</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Seniority">
          <select value={draft.seniority ?? ''} onChange={e => set('seniority', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">—</option>
            {SENIORITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select value={draft.priority ?? ''} onChange={e => set('priority', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">—</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Employment Type">
          <select value={draft.employment_type ?? ''} onChange={e => set('employment_type', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">—</option>
            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Location">
          <input value={draft.location ?? ''} onChange={e => set('location', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </Field>
        <Field label="Remote Policy">
          <select value={draft.remote_policy ?? ''} onChange={e => set('remote_policy', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">—</option>
            {REMOTE_POLICIES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Salary Min">
          <input type="number" value={draft.salary_min ?? ''} onChange={e => set('salary_min', e.target.value ? +e.target.value : null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </Field>
        <Field label="Salary Max">
          <input type="number" value={draft.salary_max ?? ''} onChange={e => set('salary_max', e.target.value ? +e.target.value : null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </Field>
        <Field label="Currency">
          <select value={draft.salary_currency ?? 'USD'} onChange={e => set('salary_currency', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Fee Type">
          <select value={draft.fee_type ?? ''} onChange={e => set('fee_type', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">—</option>
            <option value="percentage">Percentage</option>
            <option value="flat">Flat</option>
          </select>
        </Field>
        <Field label="Fee Value">
          <input type="number" step="0.01" value={draft.fee_value ?? ''} onChange={e => set('fee_value', e.target.value ? +e.target.value : null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </Field>
        <Field label="Target Close Date">
          <input type="date" value={draft.target_close_date ?? ''} onChange={e => set('target_close_date', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </Field>
      </div>

      <Field label="Description">
        <textarea value={draft.description ?? ''} onChange={e => set('description', e.target.value)}
          rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !draft.job_title?.trim()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Changes
        </button>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{label}</p>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right">{children}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

interface KanbanCardProps {
  card: KanbanCard
  onDragStart: (e: React.DragEvent, card: KanbanCard) => void
  onReject: (card: KanbanCard) => void
  isAdmin: boolean
}

function KanbanCardView({ card, onDragStart, onReject, isAdmin }: KanbanCardProps) {
  const navigate = useNavigate()
  const isLocked = card.status === 'hired' || card.status === 'rejected'

  return (
    <div
      draggable={!isLocked}
      onDragStart={e => !isLocked && onDragStart(e, card)}
      className={`bg-white border rounded-lg p-3 shadow-sm select-none group ${
        isLocked ? 'opacity-60 cursor-default border-gray-200' : 'cursor-grab active:cursor-grabbing border-gray-200 hover:border-blue-300 hover:shadow'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => navigate(`/app/contacts/${card.contact_id}`)}
          className="text-sm font-medium text-gray-800 hover:text-blue-600 text-left leading-tight"
        >
          {card.contact.first_name} {card.contact.last_name}
        </button>
        {!isLocked && isAdmin && (
          <button
            onClick={() => onReject(card)}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all shrink-0"
            title="Reject"
          >
            <XCircle size={14} />
          </button>
        )}
      </div>

      {card.contact.current_title && (
        <p className="text-xs text-gray-500 mt-0.5 truncate">{card.contact.current_title}</p>
      )}
      {card.contact.current_company && (
        <p className="text-xs text-gray-400 truncate">{card.contact.current_company}</p>
      )}

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-0.5 text-xs text-gray-400">
          <Clock size={10} /> {card.days_in_stage}d
        </span>
        {card.source === 'job_board' && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
            Job Board
          </span>
        )}
        {card.status !== 'active' && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
            card.status === 'hired' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {card.status}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

function RejectModal({
  card,
  jobTitle,
  onConfirm,
  onClose,
}: {
  card: KanbanCard
  jobTitle: string
  onConfirm: (reason: string, sendEmail: boolean) => void
  onClose: () => void
}) {
  const [reason, setReason]       = useState('')
  const [sendEmail, setSendEmail] = useState(false)
  const hasEmail = !!card.contact.email
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Reject Application</h3>
        <p className="text-sm text-gray-500 mb-4">
          {card.contact.first_name} {card.contact.last_name}
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Reason for rejection…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
        />
        {hasEmail && (
          <label className="flex items-center gap-2 text-sm text-gray-600 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={e => setSendEmail(e.target.checked)}
              className="rounded"
            />
            Send rejection email to candidate
          </label>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim(), sendEmail)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pipeline Tab ─────────────────────────────────────────────────────────────

function PipelineTab({ jobId, jobTitle, isAdmin }: { jobId: string; jobTitle: string; isAdmin: boolean }) {
  const { toast } = useToast()
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [metrics, setMetrics]  = useState<PipelineMetrics[]>([])
  const [loading, setLoading]  = useState(true)
  const [rejectTarget, setRejectTarget] = useState<KanbanCard | null>(null)
  const dragCard = useRef<KanbanCard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cols, met] = await Promise.all([
        getJobPipeline(jobId),
        getJobPipelineMetrics(jobId),
      ])
      setColumns(cols)
      setMetrics(met)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [jobId, toast])

  useEffect(() => { load() }, [load])

  const handleDragStart = (_e: React.DragEvent, card: KanbanCard) => {
    dragCard.current = card
  }

  const handleDrop = async (e: React.DragEvent, targetStageId: number) => {
    e.preventDefault()
    const card = dragCard.current
    dragCard.current = null
    if (!card || card.stage_id === targetStageId) return

    const targetCol = columns.find(c => c.stage.id === targetStageId)
    const currentCol = columns.find(c => c.stage.id === card.stage_id)
    if (!targetCol || !currentCol) return

    const isBackward = targetCol.stage.order_index < currentCol.stage.order_index
    if (isBackward && !isAdmin) {
      toast('Backward moves require admin permission', 'error')
      return
    }

    // Optimistic update
    setColumns(prev => prev.map(col => {
      if (col.stage.id === card.stage_id) {
        return { ...col, cards: col.cards.filter(c => c.id !== card.id) }
      }
      if (col.stage.id === targetStageId) {
        return { ...col, cards: [...col.cards, { ...card, stage_id: targetStageId, days_in_stage: 0 }] }
      }
      return col
    }))

    try {
      await moveApplicationStage(card.id, targetStageId, { isAdmin })
    } catch (e: any) {
      toast(e.message, 'error')
      load() // revert
    }
  }

  const handleRejectConfirm = async (reason: string, sendEmail: boolean) => {
    if (!rejectTarget) return
    const card = rejectTarget
    setRejectTarget(null)

    // Optimistic: update card status
    setColumns(prev => prev.map(col => ({
      ...col,
      cards: col.cards.map(c => c.id === card.id ? { ...c, status: 'rejected' as const } : c),
    })))

    try {
      await rejectApplication(card.id, reason)
      toast('Application rejected', 'info')
      load()
    } catch (e: any) {
      toast(e.message, 'error')
      load()
      return
    }

    // Optional rejection email — non-blocking; failure only shows a warning
    if (sendEmail && card.contact.email) {
      try {
        await sendTemplatedEmail(
          'candidate_rejection',
          {
            candidate_name: `${card.contact.first_name} ${card.contact.last_name}`,
            job_title:      jobTitle,
            company_name:   'Our Company',
          },
          card.contact.email,
          { relatedEntityType: 'applications', relatedEntityId: card.id }
        )
        toast('Rejection email sent', 'success')
      } catch {
        toast('Email send failed — rejection was saved', 'info')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading pipeline…
      </div>
    )
  }

  const totalActive = columns.reduce((sum, col) => sum + col.cards.filter(c => c.status === 'active').length, 0)

  return (
    <div className="space-y-4">
      {/* Metrics bar */}
      {metrics.some(m => m.count > 0) && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {metrics.filter(m => m.count > 0).map(m => (
            <div key={m.stage_id} className="shrink-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-gray-800">{m.count}</p>
              <p className="text-xs text-gray-500 truncate max-w-[80px]">{m.stage_name}</p>
              <p className="text-xs text-gray-400">{m.avg_days}d avg</p>
            </div>
          ))}
          <div className="shrink-0 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-blue-700">{totalActive}</p>
            <p className="text-xs text-blue-500">Active</p>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <div
            key={col.stage.id}
            className="shrink-0 w-52 flex flex-col"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, col.stage.id)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide truncate">
                {col.stage.name}
              </h3>
              <span className="ml-2 text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 shrink-0">
                {col.cards.length}
              </span>
            </div>

            {/* Drop zone */}
            <div className="flex-1 min-h-[120px] bg-gray-50/60 rounded-xl border-2 border-dashed border-gray-200 p-2 space-y-2">
              {col.cards.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-4">Drop here</p>
              ) : (
                col.cards.map(card => (
                  <KanbanCardView
                    key={card.id}
                    card={card}
                    onDragStart={handleDragStart}
                    onReject={setRejectTarget}
                    isAdmin={isAdmin}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {rejectTarget && (
        <RejectModal
          card={rejectTarget}
          jobTitle={jobTitle}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Interviews Tab ───────────────────────────────────────────────────────────

const INTERVIEW_TYPE_ICON: Record<InterviewType, React.ElementType> = {
  phone:     Phone,
  video:     Video,
  onsite:    Monitor,
  technical: Layers,
  panel:     Users2,
}

const INTERVIEW_STATUS_STYLE: Record<InterviewStatus, string> = {
  scheduled:  'bg-blue-100 text-blue-700',
  completed:  'bg-green-100 text-green-700',
  cancelled:  'bg-gray-100 text-gray-500',
  no_show:    'bg-red-100 text-red-700',
}

function ScheduleInterviewModal({
  jobId,
  jobTitle,
  onClose,
  onScheduled,
}: {
  jobId: string
  jobTitle: string
  onClose: () => void
  onScheduled: () => void
}) {
  const { toast }   = useToast()
  const [cols, setCols] = useState<KanbanColumn[]>([])
  const [selectedApp, setSelectedApp] = useState('')
  const [type, setType]     = useState<InterviewType>('video')
  const [date, setDate]     = useState('')
  const [time, setTime]     = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [round, setRound]   = useState<number | ''>('')
  const [location, setLocation] = useState('')
  const [url, setUrl]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [loadingApps, setLoadingApps] = useState(true)
  const [sendInvite, setSendInvite]   = useState(false)

  useEffect(() => {
    getJobPipeline(jobId)
      .then(setCols)
      .catch(() => {})
      .finally(() => setLoadingApps(false))
  }, [jobId])

  const activeCards = cols
    .flatMap(c => c.cards)
    .filter(c => c.status === 'active')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedApp || !date) return
    setSaving(true)
    try {
      await scheduleInterview(selectedApp, {
        scheduled_at:     `${date}T${time}:00Z`,
        type,
        duration_minutes: duration,
        round_number:     round !== '' ? +round : undefined,
        location:         location.trim() || undefined,
        meeting_url:      url.trim() || undefined,
      })
      toast('Interview scheduled', 'success')

      // Optional invitation email — non-blocking
      if (sendInvite) {
        const selectedCard = activeCards.find(c => c.id === selectedApp)
        if (selectedCard?.contact.email) {
          const dt = new Date(`${date}T${time}:00Z`)
          try {
            await sendTemplatedEmail(
              'interview_invitation',
              {
                candidate_name:  `${selectedCard.contact.first_name} ${selectedCard.contact.last_name}`,
                job_title:       jobTitle,
                interview_date:  dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                interview_time:  dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                interview_type:  type.charAt(0).toUpperCase() + type.slice(1),
                meeting_url:     url.trim() || 'TBC',
                interviewer_name: 'The Recruiting Team',
              },
              selectedCard.contact.email,
              { relatedEntityType: 'applications', relatedEntityId: selectedApp }
            )
            toast('Invitation email sent', 'success')
          } catch {
            toast('Email failed — interview was saved', 'info')
          }
        }
      }

      onScheduled()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Schedule Interview</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Candidate *</label>
            {loadingApps ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <select
                value={selectedApp}
                onChange={e => setSelectedApp(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select candidate…</option>
                {activeCards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.contact.first_name} {c.contact.last_name}
                    {c.contact.current_title ? ` — ${c.contact.current_title}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value as InterviewType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {(['phone','video','onsite','technical','panel'] as InterviewType[]).map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Round</label>
              <input
                type="number" min={1} value={round}
                onChange={e => setRound(e.target.value ? +e.target.value : '')}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time (UTC)</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
              <input type="number" min={15} step={15} value={duration} onChange={e => setDuration(+e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Room / Address"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {selectedApp && activeCards.find(c => c.id === selectedApp)?.contact.email && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={sendInvite}
                onChange={e => setSendInvite(e.target.checked)}
                className="rounded"
              />
              Send interview invitation email to candidate
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || !selectedApp || !date}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────

const RECOMMENDATION_OPTIONS: { value: FeedbackRec; label: string; className: string }[] = [
  { value: 'strong_yes', label: 'Strong Yes', className: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'yes',        label: 'Yes',        className: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'no',         label: 'No',         className: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'strong_no',  label: 'Strong No',  className: 'bg-red-100 text-red-700 border-red-300' },
]

function FeedbackModal({
  interview,
  onClose,
  onSubmitted,
}: {
  interview: InterviewWithContext
  onClose: () => void
  onSubmitted: (interviewId: string, feedback: import('../lib/interviewService').InterviewFeedback) => void
}) {
  const { toast } = useToast()
  const contact = interview.application?.contact

  const [rating,         setRating]         = useState<number | null>(null)
  const [recommendation, setRecommendation] = useState<FeedbackRec | null>(null)
  const [strengths,      setStrengths]      = useState('')
  const [concerns,       setConcerns]       = useState('')
  const [notes,          setNotes]          = useState('')
  const [saving,         setSaving]         = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fb = await submitFeedback(interview.id, null, {
        overall_rating: rating,
        recommendation,
        strengths:  strengths.trim()  || null,
        concerns:   concerns.trim()   || null,
        notes:      notes.trim()      || null,
      })
      toast('Feedback submitted', 'success')
      onSubmitted(interview.id, fb)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Submit Interview Feedback</h3>
            {contact && (
              <p className="text-sm text-gray-500 mt-0.5">
                {contact.first_name} {contact.last_name} · {interview.type} interview
                {interview.round_number ? ` · Round ${interview.round_number}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Star rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Overall rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? null : n)}
                  className={`p-1 transition-colors ${
                    rating != null && n <= rating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'
                  }`}
                >
                  <Star size={24} fill={rating != null && n <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
              {rating && <span className="ml-2 text-sm text-gray-500 self-center">{rating}/5</span>}
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recommendation</label>
            <div className="flex flex-wrap gap-2">
              {RECOMMENDATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecommendation(recommendation === opt.value ? null : opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    recommendation === opt.value
                      ? `${opt.className} ring-2 ring-offset-1`
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strengths */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Strengths</label>
            <textarea
              value={strengths}
              onChange={e => setStrengths(e.target.value)}
              rows={2}
              placeholder="What stood out positively?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Concerns */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Concerns</label>
            <textarea
              value={concerns}
              onChange={e => setConcerns(e.target.value)}
              rows={2}
              placeholder="Any reservations or red flags?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything else to note?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (!rating && !recommendation && !strengths.trim() && !concerns.trim() && !notes.trim())}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? 'Submitting…' : 'Submit feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InterviewsTab({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const { toast }       = useToast()
  const navigate        = useNavigate()
  const [interviews, setInterviews] = useState<InterviewWithContext[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [updating,   setUpdating]   = useState<string | null>(null)
  const [feedbackFor, setFeedbackFor] = useState<InterviewWithContext | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setInterviews(await getInterviewsForJob(jobId))
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [jobId, toast])

  useEffect(() => { load() }, [load])

  const changeStatus = async (id: string, status: InterviewStatus) => {
    setUpdating(id)
    try {
      await updateInterviewStatus(id, status)
      setInterviews(prev => prev.map(i => i.id === id ? { ...i, status } : i))
      toast(`Interview ${status}`, 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setUpdating(null)
    }
  }

  const handleFeedbackSubmitted = (
    interviewId: string,
    fb: import('../lib/interviewService').InterviewFeedback
  ) => {
    setInterviews(prev => prev.map(iv =>
      iv.id === interviewId
        ? { ...iv, feedback: [...(iv.feedback ?? []), fb] }
        : iv
    ))
    setFeedbackFor(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={18} /> Loading interviews…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus size={14} /> Schedule Interview
        </button>
      </div>

      {interviews.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          No interviews scheduled yet.
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map(iv => {
            const TypeIcon = INTERVIEW_TYPE_ICON[iv.type]
            const app      = iv.application
            const contact  = app?.contact as any
            const isUpdating = updating === iv.id

            return (
              <div key={iv.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 bg-white rounded-lg border border-gray-200">
                      <TypeIcon size={16} className="text-gray-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800">
                          {iv.round_number ? `Round ${iv.round_number} ` : ''}{iv.type.charAt(0).toUpperCase() + iv.type.slice(1)} Interview
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INTERVIEW_STATUS_STYLE[iv.status]}`}>
                          {iv.status}
                        </span>
                      </div>
                      {contact && (
                        <button
                          onClick={() => app?.contact && navigate(`/app/contacts/${(app.contact as any).id ?? ''}`)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {contact.first_name} {contact.last_name}
                        </button>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {new Date(iv.scheduled_at).toLocaleString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {iv.duration_minutes} min
                        </span>
                        {iv.location && <span>{iv.location}</span>}
                        {iv.meeting_url && (
                          <a href={iv.meeting_url} target="_blank" rel="noreferrer"
                            className="text-blue-500 hover:underline">Join</a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => downloadICS(iv)}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                      title="Download .ics"
                    >
                      <Download size={14} />
                    </button>
                    {isUpdating ? (
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                    ) : iv.status === 'scheduled' ? (
                      <>
                        <button
                          onClick={() => changeStatus(iv.id, 'completed')}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => changeStatus(iv.id, 'cancelled')}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => changeStatus(iv.id, 'no_show')}
                          className="text-xs text-orange-400 hover:text-orange-600"
                          title="No show"
                        >
                          <XCircle size={14} />
                        </button>
                      </>
                    ) : iv.status === 'completed' ? (
                      <button
                        onClick={() => setFeedbackFor(iv)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                        title="Submit feedback"
                      >
                        <MessageSquare size={12} /> Feedback
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Participants */}
                {iv.participants && iv.participants.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {iv.participants.map(p => (
                      <span key={p.id} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600">
                        {(p.user as any)?.full_name ?? p.external_name ?? 'Unknown'}
                        <span className="text-gray-400 ml-1">({p.role})</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Feedback summary */}
                {iv.feedback && iv.feedback.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap gap-3">
                    {iv.feedback.map(f => (
                      <span key={f.id} className="text-xs text-gray-500">
                        {f.recommendation && (
                          <span className={`px-1.5 py-0.5 rounded mr-1 font-medium ${
                            f.recommendation === 'strong_yes' ? 'bg-green-100 text-green-700' :
                            f.recommendation === 'yes' ? 'bg-blue-100 text-blue-700' :
                            f.recommendation === 'no' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>{f.recommendation.replace('_', ' ')}</span>
                        )}
                        {f.overall_rating != null && `★ ${f.overall_rating}/5`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <ScheduleInterviewModal
          jobId={jobId}
          jobTitle={jobTitle}
          onClose={() => setShowModal(false)}
          onScheduled={() => { setShowModal(false); load() }}
        />
      )}

      {feedbackFor && (
        <FeedbackModal
          interview={feedbackFor}
          onClose={() => setFeedbackFor(null)}
          onSubmitted={handleFeedbackSubmitted}
        />
      )}
    </div>
  )
}

// ─── Scorecards Tab ───────────────────────────────────────────────────────────

function ScorecardsTab({ jobId }: { jobId: string }) {
  const { toast } = useToast()
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [scorecards, setScorecards] = useState<Record<string, Scorecard[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const cols = await getJobPipeline(jobId)
        setColumns(cols)
        // Load scorecards for all applications
        const allCards = cols.flatMap(c => c.cards)
        const results = await Promise.all(
          allCards.map(async card => {
            const sc = await getScorecardsForApplication(card.id)
            return { id: card.id, sc }
          })
        )
        const map: Record<string, Scorecard[]> = {}
        for (const r of results) {
          if (r.sc.length > 0) map[r.id] = r.sc
        }
        setScorecards(map)
      } catch (e: any) {
        toast(e.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [jobId, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading scorecards…
      </div>
    )
  }

  const allCards = columns.flatMap(c => c.cards)
  const cardsWithScorecards = allCards.filter(c => scorecards[c.id]?.length > 0)

  if (cardsWithScorecards.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400 text-sm">
        No scorecards submitted yet for this job.
      </div>
    )
  }

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="space-y-3">
      {cardsWithScorecards.map(card => {
        const sc = scorecards[card.id]
        const isOpen = expanded.has(card.id)
        return (
          <div key={card.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(card.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
            >
              <div>
                <span className="text-sm font-medium text-gray-800">
                  {card.contact.first_name} {card.contact.last_name}
                </span>
                {card.contact.current_title && (
                  <span className="ml-2 text-xs text-gray-500">{card.contact.current_title}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{sc.length} scorecard{sc.length > 1 ? 's' : ''}</span>
                <ChevronRight size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {isOpen && (
              <div className="divide-y divide-gray-100">
                {sc.map(s => (
                  <div key={s.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">
                        {s.reviewer?.full_name ?? 'Anonymous'}
                      </p>
                      {s.recommendation && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RECOMMENDATION_LABELS[s.recommendation]?.color}`}>
                          {RECOMMENDATION_LABELS[s.recommendation]?.label}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {(['technical_score', 'culture_score', 'communication_score', 'overall_score'] as const).map(k => (
                        <div key={k} className="text-center">
                          <p className="text-lg font-bold text-gray-800">{s[k] ?? '—'}</p>
                          <p className="text-xs text-gray-400">{k.replace('_score', '').replace('_', ' ')}</p>
                        </div>
                      ))}
                    </div>
                    {s.notes && <p className="text-xs text-gray-500 italic">{s.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Publish Tab ─────────────────────────────────────────────────────────────

const PUB_EMPLOYMENT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'internship', label: 'Internship' },
  { value: 'executive', label: 'Executive' },
] as const

const PUB_REMOTE_POLICIES = [
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
] as const

const PUB_SENIORITY = [
  'Junior', 'Mid-level', 'Senior', 'Lead', 'Director', 'Executive',
] as const

const PUB_CURRENCIES = [
  'USD','EUR','GBP','AED','SAR','JOD','EGP','IQD','KWD','QAR','BHD','OMR',
] as const

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
        checked ? 'bg-primary' : 'bg-muted'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )
}

function PublishTab({ job, onUpdated }: { job: Job; onUpdated: (j: Job) => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCurrencyInput, setShowCurrencyInput] = useState(false)

  const [draft, setDraft] = useState({
    is_published_to_job_board: job.is_published_to_job_board,
    public_title: job.public_title ?? '',
    public_description: job.public_description ?? '',
    public_location: job.public_location ?? '',
    employment_type: job.employment_type ?? '',
    remote_policy: job.remote_policy ?? '',
    seniority_public: job.seniority_public ?? '',
    public_salary_visible: job.public_salary_visible,
    public_salary_min: job.public_salary_min,
    public_salary_max: job.public_salary_max,
    public_salary_currency: job.public_salary_currency ?? '',
    apply_deadline: job.apply_deadline ?? '',
  })

  const set = <K extends keyof typeof draft>(k: K, v: typeof draft[K]) =>
    setDraft(p => ({ ...p, [k]: v }))

  // Computed status
  const isPublished = draft.is_published_to_job_board
  const isOpen = job.status === 'open'
  const deadlinePassed = draft.apply_deadline ? new Date(draft.apply_deadline) < new Date(new Date().toDateString()) : false

  let statusColor = 'text-muted-foreground'
  let statusIcon = '○'
  let statusText = 'Not published'
  if (isPublished && isOpen && !deadlinePassed) {
    statusColor = 'text-primary'
    statusIcon = '●'
    statusText = 'Live on /jobs'
  } else if (isPublished && !isOpen) {
    statusColor = 'text-foreground/70'
    statusIcon = '○'
    statusText = "Not visible — job is not 'open'"
  } else if (isPublished && deadlinePassed) {
    statusColor = 'text-foreground/70'
    statusIcon = '○'
    statusText = 'Not visible — deadline passed'
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (draft.is_published_to_job_board) {
      if (!draft.employment_type) errs.employment_type = 'Required when publishing.'
      if (!draft.remote_policy) errs.remote_policy = 'Required when publishing.'
      if (draft.public_salary_visible) {
        if (draft.public_salary_min == null) errs.public_salary_min = 'Required when salary is visible.'
        if (draft.public_salary_max == null) errs.public_salary_max = 'Required when salary is visible.'
        if (!draft.public_salary_currency) errs.public_salary_currency = 'Required when salary is visible.'
        if (draft.public_salary_min != null && draft.public_salary_max != null && draft.public_salary_min > draft.public_salary_max) {
          errs.public_salary_max = 'Must be greater than or equal to min.'
        }
      }
      if (draft.public_salary_currency && !/^[A-Z]{3}$/.test(draft.public_salary_currency)) {
        errs.public_salary_currency = 'Must be 3 uppercase letters (e.g. USD).'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const wasUnpublished = !job.is_published_to_job_board
    try {
      const payload: Partial<Job> = {
        is_published_to_job_board: draft.is_published_to_job_board,
        public_title: draft.public_title || null,
        public_description: draft.public_description || null,
        public_location: draft.public_location || null,
        employment_type: (draft.employment_type || null) as Job['employment_type'],
        remote_policy: (draft.remote_policy || null) as Job['remote_policy'],
        seniority_public: draft.seniority_public || null,
        public_salary_visible: draft.public_salary_visible,
        public_salary_min: draft.public_salary_min,
        public_salary_max: draft.public_salary_max,
        public_salary_currency: draft.public_salary_currency || null,
        apply_deadline: draft.apply_deadline || null,
      }
      const updated = await updateJob(job.id, payload)
      onUpdated(updated)
      // Sync draft with server response
      setDraft({
        is_published_to_job_board: updated.is_published_to_job_board,
        public_title: updated.public_title ?? '',
        public_description: updated.public_description ?? '',
        public_location: updated.public_location ?? '',
        employment_type: updated.employment_type ?? '',
        remote_policy: updated.remote_policy ?? '',
        seniority_public: updated.seniority_public ?? '',
        public_salary_visible: updated.public_salary_visible,
        public_salary_min: updated.public_salary_min,
        public_salary_max: updated.public_salary_max,
        public_salary_currency: updated.public_salary_currency ?? '',
        apply_deadline: updated.apply_deadline ?? '',
      })
      toast('Job board settings saved', 'success')
      if (wasUnpublished && updated.is_published_to_job_board) {
        setJustPublished(true)
        setTimeout(() => setJustPublished(false), 2000)
      }
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-input rounded-lg px-3 py-2 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring'
  const errorCls = 'text-xs text-destructive mt-1'

  return (
    <div className="space-y-6">
      {/* Publication toggle */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
        <div>
          <p className="text-base font-semibold text-foreground">Publish to public job board</p>
          <p className="text-sm text-muted-foreground mt-0.5">Make this job visible on /jobs and accept public applications.</p>
        </div>
        <Toggle checked={draft.is_published_to_job_board} onChange={v => set('is_published_to_job_board', v)} />
      </div>

      {/* Status pill */}
      <div className={`flex items-center gap-2 text-sm ${justPublished ? 'bg-accent -mx-2 px-2 py-1 rounded-lg transition-colors' : ''}`}>
        <span className={statusColor}>{statusIcon} {statusText}</span>
        {isPublished && isOpen && !deadlinePassed && job.slug && (
          <a
            href={getPublicJobUrl(job.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View public listing <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Public version fields */}
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-foreground">Public version</p>
          <p className="text-xs text-muted-foreground mt-0.5">These fields are what candidates see on the public job board. Internal title and description above are not exposed.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Public title">
            <input value={draft.public_title} onChange={e => set('public_title', e.target.value)}
              placeholder={job.job_title}
              className={inputCls} />
            <p className="text-xs text-muted-foreground mt-1">Defaults to the internal title if left blank.</p>
          </Field>

          <Field label="Public location">
            <input value={draft.public_location} onChange={e => set('public_location', e.target.value)}
              placeholder="e.g. Amman, Jordan or Remote — MENA"
              className={inputCls} />
          </Field>

          <Field label={`Employment type${isPublished ? ' *' : ''}`}>
            <select value={draft.employment_type} onChange={e => set('employment_type', e.target.value)}
              className={`${inputCls} ${errors.employment_type ? 'border-destructive' : ''}`}>
              <option value="">—</option>
              {PUB_EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {errors.employment_type && <p className={errorCls}>{errors.employment_type}</p>}
          </Field>

          <Field label={`Remote policy${isPublished ? ' *' : ''}`}>
            <select value={draft.remote_policy} onChange={e => set('remote_policy', e.target.value)}
              className={`${inputCls} ${errors.remote_policy ? 'border-destructive' : ''}`}>
              <option value="">—</option>
              {PUB_REMOTE_POLICIES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {errors.remote_policy && <p className={errorCls}>{errors.remote_policy}</p>}
          </Field>

          <Field label="Seniority">
            <select value={draft.seniority_public} onChange={e => set('seniority_public', e.target.value)}
              className={inputCls}>
              <option value="">—</option>
              {PUB_SENIORITY.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Application deadline">
            <input type="date" value={draft.apply_deadline} onChange={e => set('apply_deadline', e.target.value)}
              className={inputCls} />
            <p className="text-xs text-muted-foreground mt-1">If set, the job stops appearing on /jobs after this date.</p>
          </Field>
        </div>

        {/* Description (full width) */}
        <Field label="Public description">
          <textarea value={draft.public_description} onChange={e => set('public_description', e.target.value)}
            rows={10} placeholder="Candidate-facing job description. Markdown supported."
            className={`${inputCls} resize-none`} />
          <p className="text-xs text-muted-foreground mt-1">Keep it candidate-facing — leave internal commentary out.</p>
        </Field>

        {/* Salary group */}
        <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Show salary range publicly</p>
              {!draft.public_salary_visible && (
                <p className="text-xs text-muted-foreground mt-0.5">Hidden from candidates. They'll see "Salary on application".</p>
              )}
            </div>
            <Toggle checked={draft.public_salary_visible} onChange={v => set('public_salary_visible', v)} />
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${!draft.public_salary_visible ? 'opacity-50' : ''}`}>
            <Field label={`Salary min${draft.public_salary_visible ? ' *' : ''}`}>
              <input type="number" value={draft.public_salary_min ?? ''} onChange={e => set('public_salary_min', e.target.value ? +e.target.value : null)}
                className={`${inputCls} ${errors.public_salary_min ? 'border-destructive' : ''}`} />
              {errors.public_salary_min && <p className={errorCls}>{errors.public_salary_min}</p>}
            </Field>
            <Field label={`Salary max${draft.public_salary_visible ? ' *' : ''}`}>
              <input type="number" value={draft.public_salary_max ?? ''} onChange={e => set('public_salary_max', e.target.value ? +e.target.value : null)}
                className={`${inputCls} ${errors.public_salary_max ? 'border-destructive' : ''}`} />
              {errors.public_salary_max && <p className={errorCls}>{errors.public_salary_max}</p>}
            </Field>
            <Field label={`Currency${draft.public_salary_visible ? ' *' : ''}`}>
              {showCurrencyInput ? (
                <div className="flex gap-2">
                  <input value={draft.public_salary_currency} onChange={e => set('public_salary_currency', e.target.value.toUpperCase().slice(0, 3))}
                    maxLength={3} placeholder="e.g. TRY"
                    className={`${inputCls} ${errors.public_salary_currency ? 'border-destructive' : ''}`} />
                  <button type="button" onClick={() => setShowCurrencyInput(false)} className="text-xs text-primary hover:underline shrink-0">List</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select value={draft.public_salary_currency} onChange={e => {
                    if (e.target.value === '__other') { setShowCurrencyInput(true); set('public_salary_currency', '') }
                    else set('public_salary_currency', e.target.value)
                  }} className={`${inputCls} ${errors.public_salary_currency ? 'border-destructive' : ''}`}>
                    <option value="">—</option>
                    {PUB_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__other">Other…</option>
                  </select>
                </div>
              )}
              {errors.public_salary_currency && <p className={errorCls}>{errors.public_salary_currency}</p>}
            </Field>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Changes
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { roles } = useAuth()

  const [job, setJob]     = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab]     = useState<Tab>('Overview')

  const isAdmin = roles.includes('admin')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getJobById(id)
      .then(j => {
        if (!j) { setError('Job not found'); return }
        setJob(j)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading…
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-500 gap-3">
        <AlertCircle size={32} className="text-red-400" />
        <p>{error ?? 'Job not found'}</p>
        <button onClick={() => navigate('/app/jobs')} className="text-blue-600 hover:underline text-sm">
          Back to Jobs
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/app/jobs')}
          className="mt-1 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{job.job_title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge value={job.status} variant="status" />
            <Badge value={job.department} variant="department" />
            <Badge value={job.seniority} variant="seniority" />
            {job.location && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin size={11} /> {job.location}
              </span>
            )}
            {job.remote_policy && (
              <span className="text-xs text-gray-400">{job.remote_policy}</span>
            )}
            {(job.salary_min || job.salary_max) && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <DollarSign size={11} />
                {fmt(job.salary_min, job.salary_currency ?? 'USD')} – {fmt(job.salary_max, job.salary_currency ?? 'USD')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-primary text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t === 'Overview'   && <Briefcase size={14} />}
              {t === 'Pipeline'   && <Users size={14} />}
              {t === 'Interviews' && <Calendar size={14} />}
              {t === 'Scorecards' && <Star size={14} />}
              {t === 'Activity'   && <Clock size={14} />}
              {t === 'Publish'   && <Globe size={14} />}
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {tab === 'Overview'    && <OverviewTab job={job} onUpdated={setJob} />}
        {tab === 'Pipeline'    && <PipelineTab jobId={job.id} jobTitle={job.job_title} isAdmin={isAdmin} />}
        {tab === 'Interviews'  && <InterviewsTab jobId={job.id} jobTitle={job.job_title} />}
        {tab === 'Scorecards'  && <ScorecardsTab jobId={job.id} />}
        {tab === 'Activity'    && (
          <ActivityTimeline subjectType="job" subjectId={job.id} />
        )}
        {tab === 'Publish'     && <PublishTab job={job} onUpdated={setJob} />}
      </div>
    </div>
  )
}
