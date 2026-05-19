import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, FileText, Briefcase, GraduationCap, Zap, ClipboardList,
  MessageSquare, Pencil, Trash2, Plus, Download, Star, StarOff, Upload,
  Loader2, X, Check, ExternalLink, AlertTriangle, Shield, Clock, Eye, Mail,
} from 'lucide-react'
import ActivityTimeline from '../components/ActivityTimeline'
import EmailComposeModal from '../components/EmailComposeModal'
import { Skeleton } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import {
  getContact, updateContact, hardDeleteContact, exportContactData,
  getResumes, uploadResume, getResumeSignedUrl, setPrimaryResume, deleteResume,
  getContactSkills, searchSkills, ensureSkill, addContactSkill, updateContactSkill, removeContactSkill,
  getExperiences, createExperience, updateExperience, deleteExperience,
  getEducation, createEducation, updateEducation, deleteEducation,
  getContactApplications,
  type Contact, type ContactResume, type ContactSkill,
  type ContactExperience, type ContactEducation, type ContactApplication,
} from '../lib/candidateService'
import { getJobs, type Job } from '../lib/jobService'
import { applyContactToJob } from '../lib/pipelineService'
import { sendTemplatedEmail } from '../lib/emailService'
import { useToast } from '../components/Toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024**2)    return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024**2).toFixed(1)} MB`
}

const TYPE_BADGE: Record<string, string> = {
  lead:      'bg-gray-100 text-gray-600',
  candidate: 'bg-blue-100 text-blue-700',
  both:      'bg-purple-100 text-purple-700',
}
const STATUS_BADGE: Record<string, string> = {
  active:          'bg-green-100 text-green-700',
  do_not_contact:  'bg-red-100 text-red-700',
  placed:          'bg-purple-100 text-purple-700',
  blacklisted:     'bg-gray-700 text-white',
}
const APP_STATUS_BADGE: Record<string, string> = {
  active:    'bg-blue-100 text-blue-700',
  rejected:  'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-600',
  hired:     'bg-green-100 text-green-700',
}

function ProficiencyDots({ level }: { level: number | null }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`w-2 h-2 rounded-full ${i <= (level ?? 0) ? 'bg-blue-500' : 'bg-gray-200'}`} />
      ))}
    </span>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = 'profile' | 'resume' | 'experience' | 'education' | 'skills' | 'applications' | 'activity'
const TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'profile',      label: 'Profile',      icon: User },
  { key: 'resume',       label: 'Resume',        icon: FileText },
  { key: 'experience',   label: 'Experience',    icon: Briefcase },
  { key: 'education',    label: 'Education',     icon: GraduationCap },
  { key: 'skills',       label: 'Skills',        icon: Zap },
  { key: 'applications', label: 'Applications',  icon: ClipboardList },
  { key: 'activity',     label: 'Activity',      icon: MessageSquare },
]

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ contact, onUpdated, onDeleted }: {
  contact: Contact
  onUpdated: (c: Contact) => void
  onDeleted: () => void
}) {
  const { roles, user, isAccountManager } = useAuth()
  const isAdmin   = roles.includes('admin')
  const canEdit   = isAdmin || isAccountManager || (contact.owner_id === user?.id)
  const [editing, setEditing]   = useState(false)
  const [form,    setForm]      = useState<Partial<Contact>>({})
  const [saving,  setSaving]    = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const startEdit = () => {
    setForm({
      first_name: contact.first_name, last_name: contact.last_name,
      email: contact.email, phone: contact.phone,
      company: contact.company, position_raw: contact.position_raw,
      linkedin_url: contact.linkedin_url,
      contact_type: contact.contact_type, candidate_status: contact.candidate_status,
      current_title: contact.current_title, current_company: contact.current_company,
      candidate_location: contact.candidate_location,
      willing_to_relocate: contact.willing_to_relocate,
      years_experience: contact.years_experience,
      expected_salary: contact.expected_salary, salary_currency: contact.salary_currency,
      notice_period_days: contact.notice_period_days,
      candidate_source: contact.candidate_source,
      candidate_source_detail: contact.candidate_source_detail,
      gdpr_consent_at: contact.gdpr_consent_at, gdpr_expires_at: contact.gdpr_expires_at,
    })
    setEditing(true)
  }

  const handleSave = async () => {
    if (!form.first_name?.trim() || !form.last_name?.trim()) {
      setError('First and last name are required'); return
    }
    setSaving(true)
    try {
      const updated = await updateContact(contact.id, form)
      onUpdated(updated)
      setEditing(false)
    } catch (err: any) { setError(err.message)
    } finally { setSaving(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await exportContactData(contact.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `contact_${contact.id}_export.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await hardDeleteContact(contact.id)
      onDeleted()
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-800">{value || <span className="text-gray-300">—</span>}</dd>
    </div>
  )

  const inp = (key: keyof Contact, label: string, type = 'text') => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={(form as any)[key] ?? ''}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {inp('first_name', 'First name *')}
          {inp('last_name',  'Last name *')}
          {inp('email',      'Email', 'email')}
          {inp('phone',      'Phone')}
          {inp('company',    'Company')}
          {inp('position_raw', 'Raw position')}
          {inp('linkedin_url', 'LinkedIn URL')}
          {inp('current_title',   'Current title')}
          {inp('current_company', 'Current company')}
          {inp('candidate_location', 'Location')}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contact type</label>
            <select value={form.contact_type ?? 'lead'} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value as Contact['contact_type'] }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="lead">Lead</option>
              <option value="candidate">Candidate</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Candidate status</label>
            <select value={form.candidate_status ?? ''} onChange={e => setForm(f => ({ ...f, candidate_status: (e.target.value as Contact['candidate_status']) || null }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">None</option>
              <option value="active">Active</option>
              <option value="do_not_contact">Do not contact</option>
              <option value="placed">Placed</option>
              <option value="blacklisted">Blacklisted</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Source</label>
            <select value={form.candidate_source ?? ''} onChange={e => setForm(f => ({ ...f, candidate_source: e.target.value || null }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">None</option>
              {['inbound','referral','linkedin','job_board','headhunted','other'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {inp('candidate_source_detail', 'Source detail')}
          {inp('years_experience', 'Years experience', 'number')}
          {inp('expected_salary',  'Expected salary', 'number')}
          {inp('salary_currency',  'Currency')}
          {inp('notice_period_days', 'Notice (days)', 'number')}
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" checked={form.willing_to_relocate ?? false} onChange={e => setForm(f => ({ ...f, willing_to_relocate: e.target.checked }))} className="rounded" />
            <label className="text-sm text-gray-700">Willing to relocate</label>
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}<Check size={14} /> Save
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {contact.contact_type && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[contact.contact_type]}`}>
              {contact.contact_type}
            </span>
          )}
          {contact.candidate_status && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[contact.candidate_status] ?? 'bg-gray-100 text-gray-600'}`}>
              {contact.candidate_status.replace('_', ' ')}
            </span>
          )}
        </div>
        {canEdit && (
          <button onClick={startEdit} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {field('Email', contact.email ? <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a> : null)}
        {field('Phone', contact.phone ? <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a> : null)}
        {field('LinkedIn', contact.linkedin_url ? <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">View <ExternalLink size={11} /></a> : null)}
        {field('Company', contact.company)}
        {field('Raw position', contact.position_raw)}
        {field('Current title', contact.current_title)}
        {field('Current company', contact.current_company)}
        {field('Location', contact.candidate_location)}
        {field('Relocate', contact.willing_to_relocate === null ? null : contact.willing_to_relocate ? 'Yes' : 'No')}
        {field('Experience', contact.years_experience ? `${contact.years_experience} yrs` : null)}
        {field('Expected salary', contact.expected_salary ? `${contact.expected_salary} ${contact.salary_currency ?? ''}` : null)}
        {field('Notice', contact.notice_period_days ? `${contact.notice_period_days} days` : null)}
        {field('Source', contact.candidate_source)}
        {field('Source detail', contact.candidate_source_detail)}
        {field('Owner', contact.owner?.full_name ?? contact.owner?.email)}
        {field('GDPR consent', fmt(contact.gdpr_consent_at))}
        {field('GDPR expires', fmt(contact.gdpr_expires_at))}
        {field('Added', fmt(contact.created_at))}
      </div>

      {/* GDPR actions */}
      <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-3">
        <button onClick={handleExport} disabled={exporting} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Export data
        </button>
        {isAdmin && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50">
            <Trash2 size={14} /> Delete all data
          </button>
        )}
        {isAdmin && confirmDelete && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
            <AlertTriangle size={14} className="text-red-500" />
            <span className="text-sm text-red-700">Permanently delete this contact and all data?</span>
            <button onClick={handleDelete} disabled={deleting} className="text-sm text-red-600 font-medium hover:text-red-800 disabled:opacity-50 flex items-center gap-1">
              {deleting && <Loader2 size={12} className="animate-spin" />} Yes, delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}

// ─── Resume Tab ───────────────────────────────────────────────────────────────

function ResumeTab({ contactId }: { contactId: string }) {
  const [resumes,        setResumes]        = useState<ContactResume[]>([])
  const [loading,        setLoading]        = useState(true)
  const [uploading,      setUploading]      = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null)
  const [previewName,    setPreviewName]    = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setResumes(await getResumes(contactId)) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [contactId])

  useEffect(() => { load() }, [load])

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadResume(contactId, files[0]!)
      setResumes(prev => [uploaded, ...prev])
    } catch (e: any) { setError(e.message)
    } finally { setUploading(false) }
  }

  const handleDownload = async (r: ContactResume) => {
    try {
      const url = await getResumeSignedUrl(r)
      window.open(url, '_blank')
    } catch (e: any) { setError(e.message) }
  }

  const handlePreview = async (r: ContactResume) => {
    setPreviewLoading(r.id)
    try {
      const url = await getResumeSignedUrl(r)
      setPreviewName(r.file_name ?? r.file_url.split('/').pop() ?? 'Resume')
      setPreviewUrl(url)
    } catch (e: any) { setError(e.message)
    } finally { setPreviewLoading(null) }
  }

  const handleSetPrimary = async (r: ContactResume) => {
    await setPrimaryResume(contactId, r.id)
    setResumes(prev => prev.map(x => ({ ...x, is_primary: x.id === r.id })))
  }

  const handleDelete = async (r: ContactResume) => {
    if (!confirm('Delete this resume?')) return
    try {
      await deleteResume(r)
      setResumes(prev => prev.filter(x => x.id !== r.id))
    } catch (e: any) { setError(e.message) }
  }

  if (loading) return <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>

  return (
    <>
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={e => handleFiles(e.target.files)} />
          {uploading
            ? <><Loader2 size={24} className="animate-spin mx-auto text-blue-500 mb-2" /><p className="text-sm text-blue-600">Uploading…</p></>
            : <><Upload size={24} className="mx-auto text-gray-400 mb-2" /><p className="text-sm text-gray-500">Click or drag a PDF / DOCX to upload <span className="text-gray-400">(max 10 MB)</span></p></>
          }
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {!resumes.length ? (
          <EmptyState icon={FileText} title="No resumes yet" description="Upload a PDF or DOCX above" />
        ) : (
          <div className="divide-y divide-gray-100">
            {resumes.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-3 group">
                <FileText size={20} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.file_name ?? r.file_url.split('/').pop()}</p>
                  <p className="text-xs text-gray-400">{fmtSize(r.file_size)} · {fmt(r.created_at)}</p>
                </div>
                {r.is_primary && <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded font-medium shrink-0">Primary</span>}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {r.mime_type === 'application/pdf' && (
                    <button
                      onClick={() => handlePreview(r)}
                      title="Preview"
                      className="p-1.5 text-gray-400 hover:text-blue-500 rounded"
                    >
                      {previewLoading === r.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Eye size={14} />}
                    </button>
                  )}
                  <button onClick={() => handleDownload(r)} title="Download" className="p-1.5 text-gray-400 hover:text-blue-500 rounded"><Download size={14} /></button>
                  {!r.is_primary && <button onClick={() => handleSetPrimary(r)} title="Set primary" className="p-1.5 text-gray-400 hover:text-yellow-500 rounded"><Star size={14} /></button>}
                  <button onClick={() => handleDelete(r)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              <span className="text-white text-sm font-medium truncate max-w-xs">{previewName}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg transition-colors"
              >
                <ExternalLink size={12} /> Open in new tab
              </a>
              <button
                onClick={() => setPreviewUrl(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <iframe
            src={previewUrl}
            className="flex-1 w-full border-0"
            title="Resume preview"
          />
        </div>
      )}
    </>
  )
}

// ─── Experience Tab ───────────────────────────────────────────────────────────

function ExperienceTab({ contactId }: { contactId: string }) {
  const { toast } = useToast()
  const [items,   setItems]   = useState<ContactExperience[]>([])
  const [loading, setLoading] = useState(true)
  const [editId,  setEditId]  = useState<string | 'new' | null>(null)
  const [form,    setForm]    = useState<Partial<ContactExperience>>({})
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    getExperiences(contactId).then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [contactId])

  const reset = () => { setForm({}); setEditId(null); setError(null) }

  const startAdd  = () => { setForm({ contact_id: contactId, is_current: false }); setEditId('new') }
  const startEdit = (x: ContactExperience) => { setForm(x); setEditId(x.id) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId === 'new') {
        const created = await createExperience({ contact_id: contactId, is_current: form.is_current ?? false, company: form.company ?? null, title: form.title ?? null, start_date: form.start_date ?? null, end_date: form.end_date ?? null, description: form.description ?? null, location: form.location ?? null })
        setItems(prev => [created, ...prev])
      } else if (editId) {
        const updated = await updateExperience(editId, form)
        setItems(prev => prev.map(x => x.id === editId ? updated : x))
      }
      reset()
    } catch (err: any) { setError(err.message)
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this experience?')) return
    try {
      await deleteExperience(id)
      setItems(prev => prev.filter(x => x.id !== id))
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  if (loading) return <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>

  const ExperienceForm = () => (
    <form onSubmit={handleSave} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {(['company','title','location'] as const).map(k => (
          <div key={k}>
            <label className="text-xs text-gray-500 mb-1 block capitalize">{k}</label>
            <input value={(form as any)[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value || null }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Start date</label>
          <input type="date" value={form.start_date ?? ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value || null }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">End date</label>
          <input type="date" value={form.end_date ?? ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value || null }))} disabled={form.is_current ?? false} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-gray-100" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" checked={form.is_current ?? false} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked, end_date: e.target.checked ? null : f.end_date }))} className="rounded" />
        Current position
      </label>
      <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))} placeholder="Description" rows={3} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
          {saving && <Loader2 size={13} className="animate-spin" />}{editId === 'new' ? 'Add' : 'Save'}
        </button>
        <button type="button" onClick={reset} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
      </div>
    </form>
  )

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={startAdd} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"><Plus size={14} /> Add experience</button>
      </div>
      {editId === 'new' && <ExperienceForm />}
      {!items.length && editId !== 'new' ? (
        <EmptyState icon={Briefcase} title="No experience recorded" description="Add work history entries above" />
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map(x => editId === x.id ? (
            <div key={x.id} className="py-3"><ExperienceForm /></div>
          ) : (
            <div key={x.id} className="py-3 flex gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{x.title ?? '—'}</p>
                  {x.is_current && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Current</span>}
                </div>
                <p className="text-sm text-gray-600">{x.company ?? '—'}</p>
                <p className="text-xs text-gray-400">
                  {fmt(x.start_date, { month: 'short', year: 'numeric' })} – {x.is_current ? 'Present' : fmt(x.end_date, { month: 'short', year: 'numeric' })}
                  {x.location ? ` · ${x.location}` : ''}
                </p>
                {x.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{x.description}</p>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => startEdit(x)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded"><Pencil size={13} /></button>
                <button onClick={() => handleDelete(x.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><X size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Education Tab ────────────────────────────────────────────────────────────

function EducationTab({ contactId }: { contactId: string }) {
  const { toast } = useToast()
  const [items,   setItems]   = useState<ContactEducation[]>([])
  const [loading, setLoading] = useState(true)
  const [editId,  setEditId]  = useState<string | 'new' | null>(null)
  const [form,    setForm]    = useState<Partial<ContactEducation>>({})
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    getEducation(contactId).then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [contactId])

  const reset = () => { setForm({}); setEditId(null); setError(null) }
  const startAdd  = () => { setForm({ contact_id: contactId }); setEditId('new') }
  const startEdit = (x: ContactEducation) => { setForm(x); setEditId(x.id) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId === 'new') {
        const created = await createEducation({ contact_id: contactId, institution: form.institution ?? null, degree: form.degree ?? null, field: form.field ?? null, start_year: form.start_year ?? null, end_year: form.end_year ?? null })
        setItems(prev => [created, ...prev])
      } else if (editId) {
        const updated = await updateEducation(editId, form)
        setItems(prev => prev.map(x => x.id === editId ? updated : x))
      }
      reset()
    } catch (err: any) { setError(err.message)
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this education record?')) return
    try {
      await deleteEducation(id)
      setItems(prev => prev.filter(x => x.id !== id))
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  if (loading) return <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>

  const EducationForm = () => (
    <form onSubmit={handleSave} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {(['institution','degree','field'] as const).map(k => (
          <div key={k}>
            <label className="text-xs text-gray-500 mb-1 block capitalize">{k}</label>
            <input value={(form as any)[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value || null }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Start year</label>
          <input type="number" value={form.start_year ?? ''} onChange={e => setForm(f => ({ ...f, start_year: e.target.value ? +e.target.value : null }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">End year</label>
          <input type="number" value={form.end_year ?? ''} onChange={e => setForm(f => ({ ...f, end_year: e.target.value ? +e.target.value : null }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
          {saving && <Loader2 size={13} className="animate-spin" />}{editId === 'new' ? 'Add' : 'Save'}
        </button>
        <button type="button" onClick={reset} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
      </div>
    </form>
  )

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={startAdd} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"><Plus size={14} /> Add education</button>
      </div>
      {editId === 'new' && <EducationForm />}
      {!items.length && editId !== 'new' ? (
        <EmptyState icon={GraduationCap} title="No education recorded" />
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map(x => editId === x.id ? (
            <div key={x.id} className="py-3"><EducationForm /></div>
          ) : (
            <div key={x.id} className="py-3 flex items-start justify-between gap-3 group">
              <div>
                <p className="text-sm font-medium text-gray-900">{x.degree}{x.field ? ` in ${x.field}` : ''}</p>
                <p className="text-sm text-gray-600">{x.institution ?? '—'}</p>
                <p className="text-xs text-gray-400">{x.start_year ?? '?'} – {x.end_year ?? 'Present'}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => startEdit(x)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded"><Pencil size={13} /></button>
                <button onClick={() => handleDelete(x.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><X size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Skills Tab ───────────────────────────────────────────────────────────────

function SkillsTab({ contactId }: { contactId: string }) {
  const [skills,      setSkills]      = useState<ContactSkill[]>([])
  const [loading,     setLoading]     = useState(true)
  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; category: string | null }[]>([])
  const [selected,    setSelected]    = useState<{ id: string; name: string } | null>(null)
  const [years,       setYears]       = useState('')
  const [proficiency, setProficiency] = useState(0)
  const [adding,      setAdding]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    getContactSkills(contactId).then(setSkills).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [contactId])

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      const res = await searchSkills(query)
      setSuggestions(res)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const handleAdd = async () => {
    if (!query.trim()) return
    setAdding(true)
    setError(null)
    try {
      const skill = selected ?? await ensureSkill(query.trim())
      if (skills.find(s => s.skill_id === skill.id)) { setError('Already added'); return }
      const cs = await addContactSkill(contactId, skill.id, years ? +years : null, proficiency || null)
      setSkills(prev => [...prev, cs])
      setQuery(''); setSelected(null); setYears(''); setProficiency(0); setSuggestions([])
    } catch (e: any) { setError(e.message)
    } finally { setAdding(false) }
  }

  const handleRemove = async (skillId: string) => {
    await removeContactSkill(contactId, skillId)
    setSkills(prev => prev.filter(s => s.skill_id !== skillId))
  }

  if (loading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-48" />)}</div>

  return (
    <div className="space-y-4">
      {/* Add skill row */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="relative">
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null) }}
            placeholder="Search or create skill…"
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {suggestions.length > 0 && !selected && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 mt-0.5 max-h-40 overflow-y-auto">
              {suggestions.map(s => (
                <button key={s.id} onClick={() => { setSelected(s); setQuery(s.name); setSuggestions([]) }} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50">
                  {s.name}{s.category ? <span className="text-gray-400 ml-2 text-xs">{s.category}</span> : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Years</label>
            <input type="number" value={years} onChange={e => setYears(e.target.value)} placeholder="—" className="w-20 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Proficiency (1–5)</label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(i => (
                <button key={i} onClick={() => setProficiency(i === proficiency ? 0 : i)} className={`w-7 h-7 rounded text-xs font-medium border transition-colors ${i <= proficiency ? 'bg-primary text-primary-foreground border-primary' : 'bg-white border-gray-300 text-gray-500 hover:border-blue-400'}`}>{i}</button>
              ))}
            </div>
          </div>
          <button onClick={handleAdd} disabled={!query.trim() || adding} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {/* Current skills */}
      {!skills.length ? (
        <EmptyState icon={Zap} title="No skills added" description="Search or type a skill name above" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map(s => (
            <div key={s.skill_id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 group">
              <span className="text-sm font-medium text-gray-800">{s.skill?.name}</span>
              {s.years && <span className="text-xs text-gray-400">{s.years}y</span>}
              {s.proficiency && <ProficiencyDots level={s.proficiency} />}
              <button onClick={() => handleRemove(s.skill_id)} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Apply to Job Modal ───────────────────────────────────────────────────────

function ApplyToJobModal({
  contactId,
  contactFirstName,
  contactLastName,
  contactEmail,
  existingJobIds,
  onClose,
  onApplied,
}: {
  contactId: string
  contactFirstName: string
  contactLastName: string
  contactEmail: string | null
  existingJobIds: Set<string>
  onClose: () => void
  onApplied: (app: ContactApplication) => void
}) {
  const { toast } = useToast()
  const [jobs, setJobs]         = useState<Job[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Job | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    getJobs('open').then(setJobs).catch(e => toast(e.message, 'error')).finally(() => setLoading(false))
  }, [toast])

  const filtered = jobs.filter(j =>
    !existingJobIds.has(j.id) &&
    j.job_title.toLowerCase().includes(search.toLowerCase())
  )

  const handleApply = async () => {
    if (!selected) return
    setApplying(true)
    try {
      const app = await applyContactToJob(contactId, selected.id)
      toast('Applied to job', 'success')
      onApplied(app as unknown as ContactApplication)
      // Notify candidate their application was received
      if (contactEmail) {
        sendTemplatedEmail('application_received', {
          candidate_name: `${contactFirstName} ${contactLastName}`.trim(),
          job_title:      selected.job_title,
        }, contactEmail, {
          relatedEntityType: 'application',
          relatedEntityId:   (app as any).id,
        }).catch(() => {})
      }
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Apply to Job</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search open jobs…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {loading ? (
          <div className="py-6 text-center text-gray-400 text-sm"><Loader2 className="animate-spin inline mr-1" size={14} /> Loading…</div>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No open jobs available</p>
        ) : (
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200 mb-4">
            {filtered.map(j => (
              <button
                key={j.id}
                onClick={() => setSelected(prev => prev?.id === j.id ? null : j)}
                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${selected?.id === j.id ? 'bg-blue-50' : ''}`}
              >
                <p className={`text-sm font-medium ${selected?.id === j.id ? 'text-blue-700' : 'text-gray-800'}`}>{j.job_title}</p>
                <p className="text-xs text-gray-400">{[j.department, j.seniority].filter(Boolean).join(' · ')}</p>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!selected || applying}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg"
          >
            {applying ? <Loader2 size={14} className="animate-spin" /> : <Briefcase size={14} />}
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Applications Tab ─────────────────────────────────────────────────────────

function ApplicationsTab({
  contactId, contactFirstName, contactLastName, contactEmail,
}: {
  contactId: string
  contactFirstName: string
  contactLastName: string
  contactEmail: string | null
}) {
  const navigate = useNavigate()
  const [apps,    setApps]    = useState<ContactApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [showApply, setShowApply] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getContactApplications(contactId)
      .then(setApps)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [contactId])

  useEffect(() => { load() }, [load])

  const existingJobIds = new Set(apps.map(a => a.job_id))

  const daysInStage = (lastChanged: string) =>
    Math.floor((Date.now() - new Date(lastChanged).getTime()) / 86_400_000)

  if (loading) return <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
  if (error)   return <p className="text-sm text-red-500">{error}</p>

  return (
    <div className="space-y-4">
      {/* Action row */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowApply(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Apply to Job
        </button>
      </div>

      {apps.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No applications yet" description="Apply this contact to a job to track their pipeline progress" />
      ) : (
        <div className="divide-y divide-gray-100">
          {apps.map(a => {
            const job     = a.job as any
            const stage   = a.stage as any
            const days    = daysInStage(a.last_stage_change_at)

            return (
              <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <button
                    onClick={() => navigate(`/app/jobs/${a.job_id}`)}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 text-left leading-tight flex items-center gap-1"
                  >
                    {job?.job_title ?? '—'}
                    <ExternalLink size={11} className="text-gray-400 shrink-0" />
                  </button>
                  <p className="text-xs text-gray-400">{job?.department ?? ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {stage?.name && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      {stage.name}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    <Clock size={10} /> {days}d
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${APP_STATUS_BADGE[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {a.status}
                  </span>
                  <span className="text-xs text-gray-400">{fmt(a.applied_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showApply && (
        <ApplyToJobModal
          contactId={contactId}
          contactFirstName={contactFirstName}
          contactLastName={contactLastName}
          contactEmail={contactEmail}
          existingJobIds={existingJobIds}
          onClose={() => setShowApply(false)}
          onApplied={() => { setShowApply(false); load() }}
        />
      )}
    </div>
  )
}

// ─── ContactDetailPage ────────────────────────────────────────────────────────

export default function ContactDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tab,     setTab]     = useState<Tab>('profile')
  const [showEmailModal, setShowEmailModal] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContact(id)
      .then(setContact)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="max-w-5xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2 mt-4">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-9 w-24" />)}</div>
      </div>
    )
  }

  if (error || !contact) {
    return <p className="text-sm text-red-500">{error ?? 'Contact not found'}</p>
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Back + header */}
      <div>
        <button onClick={() => navigate('/app/contacts')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2">
          <ArrowLeft size={14} /> Contacts
        </button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <User size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{contact.first_name} {contact.last_name}</h2>
              <p className="text-sm text-gray-500">
                {[contact.current_title ?? contact.position_raw, contact.current_company ?? contact.company].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowEmailModal(true)}
            disabled={!contact.email}
            title={contact.email ? `Send email to ${contact.email}` : 'No email address on file'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Mail size={14} /> Send Email
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        {tab === 'profile' && (
          <ProfileTab
            contact={contact}
            onUpdated={setContact}
            onDeleted={() => navigate('/app/contacts', { replace: true })}
          />
        )}
        {tab === 'resume'       && <ResumeTab      contactId={contact.id} />}
        {tab === 'experience'   && <ExperienceTab  contactId={contact.id} />}
        {tab === 'education'    && <EducationTab   contactId={contact.id} />}
        {tab === 'skills'       && <SkillsTab      contactId={contact.id} />}
        {tab === 'applications' && (
          <ApplicationsTab
            contactId={contact.id}
            contactFirstName={contact.first_name}
            contactLastName={contact.last_name}
            contactEmail={contact.email ?? null}
          />
        )}
        {tab === 'activity'     && <ActivityTimeline subjectType="contact" subjectId={contact.id} />}
      </div>

      {showEmailModal && (
        <EmailComposeModal
          contact={{
            id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email ?? '',
            current_company: contact.current_company ?? undefined,
            company: contact.company ?? undefined,
          }}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}
