import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Pencil, X, ChevronDown, ChevronUp, Search,
  Download, Trash2, RotateCcw, Building2, Lock,
} from 'lucide-react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { SkeletonTable } from '../components/LoadingSkeleton'
import TagInput from '../components/TagInput'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import {
  getJobs, createJob, updateJob, deleteJob,
  type Job,
} from '../lib/jobService'
import { getClients, type Client } from '../lib/clientService'
import {
  getShortlist, updateShortlistStatus, updateShortlistNotes, removeFromShortlist,
  type ShortlistEntry,
} from '../lib/shortlistService'
import { exportShortlistToCSV, downloadCSV } from '../lib/exportService'

// ─── Constants ────────────────────────────────────────────────────────────────

const SENIORITY_LEVELS = ['Intern','Junior','Mid','Senior','Lead','Manager','Director','VP','C-Suite']
const DEPARTMENTS = [
  'Architecture','Consulting','Data','Design','Education','Energy',
  'Engineering','Executive','Finance','Healthcare','Hospitality',
  'HR','Legal','Marketing','Operations','Product','Real Estate','Sales','Other',
]
const STATUSES: Job['status'][] = ['open', 'on_hold', 'closed']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1mo ago' : `${months}mo ago`
}

// ─── Job Modal ────────────────────────────────────────────────────────────────

interface JobModalProps {
  initial?: Job | null
  onClose: () => void
  onSave: (job: Job) => void
}

function JobModal({ initial, onClose, onSave }: JobModalProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [jobTitle, setJobTitle]         = useState(initial?.job_title   ?? '')
  const [department, setDepartment]     = useState(initial?.department  ?? '')
  const [seniority, setSeniority]       = useState(initial?.seniority   ?? '')
  const [keywords, setKeywords]         = useState<string[]>(initial?.keywords ?? [])
  const [description, setDescription]   = useState(initial?.description ?? '')
  const [clientId, setClientId]         = useState<string | null>(initial?.client_id ?? null)
  const [clients, setClients]           = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)

  useEffect(() => {
    getClients({ status: ['active'] })
      .then(r => setClients(r.data))
      .catch(() => {})
      .finally(() => setLoadingClients(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jobTitle.trim()) return
    setSaving(true)
    try {
      const payload = {
        job_title:   jobTitle.trim(),
        department:  department || undefined,
        seniority:   seniority  || undefined,
        keywords,
        description: description.trim() || undefined,
        client_id:   clientId,
      }
      const job = initial
        ? await updateJob(initial.id, payload)
        : await createJob(payload)
      toast(initial ? 'Job updated' : 'Job created', 'success')
      onSave(job)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Job' : 'New Job'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
            <input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Client assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assign to</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setClientId(null)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                  clientId === null
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                <Lock size={13} /> Internal
              </button>
              <div className="flex-1">
                <select
                  value={clientId ?? ''}
                  onChange={e => setClientId(e.target.value || null)}
                  disabled={loadingClients}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
                    clientId !== null
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-300 text-gray-500'
                  }`}
                >
                  <option value="">— Select a client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {clientId !== null && (
              <p className="mt-1.5 text-xs text-blue-600 flex items-center gap-1">
                <Building2 size={11} />
                This job will appear in the client portal for <strong>{clients.find(c => c.id === clientId)?.name ?? '…'}</strong>
              </p>
            )}
            {clientId === null && (
              <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                <Lock size={11} /> Internal only — not visible in any client portal
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Any</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seniority</label>
              <select
                value={seniority}
                onChange={e => setSeniority(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Any</option>
                {SENIORITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <TagInput value={keywords} onChange={setKeywords} placeholder="Add keywords, press Enter" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional notes about this role…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !jobTitle.trim()}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Shortlist Panel ──────────────────────────────────────────────────────────

interface ShortlistPanelProps {
  job: Job
  onNavigateSearch: () => void
}

function ShortlistPanel({ job, onNavigateSearch }: ShortlistPanelProps) {
  const { toast } = useToast()
  const [entries, setEntries]   = useState<ShortlistEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft]     = useState('')
  const [confirm, setConfirm]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setEntries(await getShortlist(job.id))
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [job.id, toast])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (entry: ShortlistEntry, status: ShortlistEntry['status']) => {
    try {
      const updated = await updateShortlistStatus(entry.id, status)
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: updated.status } : e))
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const handleSaveNotes = async (entry: ShortlistEntry) => {
    try {
      await updateShortlistNotes(entry.id, notesDraft)
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, notes: notesDraft } : e))
      setEditingNotes(null)
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const handleRemove = async (entryId: string) => {
    try {
      await removeFromShortlist(entryId)
      setEntries(prev => prev.filter(e => e.id !== entryId))
      toast('Removed from shortlist', 'info')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setConfirm(null)
    }
  }

  const handleExport = () => {
    if (!entries.length) return
    const csv = exportShortlistToCSV(entries)
    downloadCSV(csv, `shortlist-${job.job_title.replace(/\s+/g, '-')}.csv`)
    toast('Shortlist exported', 'success')
  }

  if (loading) return <div className="py-6 text-center text-sm text-gray-400">Loading shortlist…</div>

  if (!entries.length) return (
    <div className="py-6 text-center">
      <p className="text-sm text-gray-500 mb-3">No candidates shortlisted yet.</p>
      <button
        onClick={onNavigateSearch}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        <Search size={14} /> Search Candidates
      </button>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-700">{entries.length} candidate{entries.length > 1 ? 's' : ''} shortlisted</p>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-gray-500">
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Notes</th>
              <th className="px-3 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-800">
                    {entry.contact?.first_name} {entry.contact?.last_name}
                  </p>
                  {entry.contact?.email && (
                    <p className="text-gray-400 truncate max-w-[160px]">{entry.contact.email}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 max-w-[100px] truncate">
                  {entry.contact?.company ?? '—'}
                </td>
                <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate">
                  {entry.categorization?.normalized_title ?? entry.contact?.position_raw ?? '—'}
                </td>
                <td className="px-3 py-2 text-gray-700 font-medium">
                  {entry.match_score.toFixed(1)}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={entry.status}
                    onChange={e => handleStatusChange(entry, e.target.value as ShortlistEntry['status'])}
                    className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="interested">Interested</option>
                    <option value="rejected">Rejected</option>
                    <option value="placed">Placed</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  {editingNotes === entry.id ? (
                    <div className="flex gap-1">
                      <input
                        autoFocus
                        value={notesDraft}
                        onChange={e => setNotesDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveNotes(entry)
                          if (e.key === 'Escape') setEditingNotes(null)
                        }}
                        className="border border-blue-400 rounded px-1.5 py-0.5 text-xs w-32 focus:outline-none"
                      />
                      <button onClick={() => handleSaveNotes(entry)} className="text-blue-600 hover:text-blue-800 text-xs">Save</button>
                      <button onClick={() => setEditingNotes(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingNotes(entry.id); setNotesDraft(entry.notes ?? '') }}
                      className="text-gray-400 hover:text-gray-700 text-left max-w-[140px] truncate"
                    >
                      {entry.notes ? entry.notes : <span className="text-gray-300 italic">add note…</span>}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => setConfirm(entry.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title="Remove from Shortlist"
        message="Are you sure you want to remove this candidate from the shortlist?"
        confirmText="Remove"
        destructive
        onConfirm={() => confirm && handleRemove(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RequestsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const [jobs, setJobs]           = useState<Job[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())
  const [modal, setModal]         = useState<'create' | Job | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null)
  const [clientMap, setClientMap] = useState<Record<string, string>>({})

  useEffect(() => {
    getClients().then(r => {
      const map: Record<string, string> = {}
      r.data.forEach(c => { map[c.id] = c.name })
      setClientMap(map)
    }).catch(() => {})
  }, [])

  const expandRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getJobs(statusFilter as Job['status'] || undefined)
      setJobs(data)

      const expandId = searchParams.get('expand')
      if (expandId && expandRef.current !== expandId) {
        expandRef.current = expandId
        setExpanded(prev => new Set([...prev, expandId]))
      }
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchParams, toast])

  useEffect(() => { load() }, [load])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSaveModal = (job: Job) => {
    setJobs(prev => {
      const idx = prev.findIndex(j => j.id === job.id)
      return idx >= 0
        ? prev.map(j => j.id === job.id ? job : j)
        : [job, ...prev]
    })
    setModal(null)
  }

  const handleToggleStatus = async (job: Job) => {
    const next: Job['status'] = job.status === 'open' ? 'closed' : 'open'
    try {
      const updated = await updateJob(job.id, { status: next })
      setJobs(prev => prev.map(j => j.id === job.id ? updated : j))
      toast(`Job marked as ${next}`, 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteJob(deleteTarget.id)
      setJobs(prev => prev.filter(j => j.id !== deleteTarget.id))
      toast('Job deleted', 'info')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Jobs</h2>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Loading…' : `${jobs.length} job${jobs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> New Job
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex gap-3 items-center">
        <span className="text-sm text-gray-500 font-medium">Status:</span>
        {(['', 'open', 'on_hold', 'closed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'All' : s === 'on_hold' ? 'On Hold' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium w-8"></th>
                <th className="px-4 py-3 font-medium">Job Title</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Seniority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Keywords</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <SkeletonTable rows={6} />
            ) : jobs.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="No jobs yet" description="Create a job to start finding candidates" />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {jobs.map(job => {
                  const isExpanded = expanded.has(job.id)
                  return (
                    <>
                      <tr
                        key={job.id}
                        onClick={() => navigate(`/app/jobs/${job.id}`)}
                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-400" onClick={e => { e.stopPropagation(); toggleExpand(job.id) }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{job.job_title}</td>
                        <td className="px-4 py-3">
                          {job.client_id ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full w-fit">
                              <Building2 size={11} /> {clientMap[job.client_id] ?? '…'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Lock size={11} /> Internal
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge value={job.department} variant="department" />
                        </td>
                        <td className="px-4 py-3">
                          <Badge value={job.seniority} variant="seniority" />
                        </td>
                        <td className="px-4 py-3">
                          <Badge value={job.status} variant="status" />
                        </td>
                        <td className="px-4 py-3">
                          {job.keywords.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {job.keywords.slice(0, 3).map(kw => (
                                <span key={kw} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{kw}</span>
                              ))}
                              {job.keywords.length > 3 && (
                                <span className="text-xs text-gray-400">+{job.keywords.length - 3}</span>
                              )}
                            </div>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{relativeDate(job.created_at)}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/app/search?request=${job.id}&title=${encodeURIComponent(job.job_title)}&dept=${job.department ?? ''}&seniority=${job.seniority ?? ''}`)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors"
                            >
                              <Search size={11} /> Search
                            </button>
                            <button
                              onClick={() => setModal(job)}
                              className="text-gray-400 hover:text-gray-700 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(job)}
                              className="text-gray-400 hover:text-gray-700 transition-colors"
                              title={job.status === 'open' ? 'Close job' : 'Reopen job'}
                            >
                              <RotateCcw size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(job)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${job.id}-expanded`} className="bg-blue-50 border-b border-blue-100">
                          <td colSpan={8} className="px-8 py-5">
                            {job.description && (
                              <p className="text-sm text-gray-600 mb-4 italic">{job.description}</p>
                            )}
                            <ShortlistPanel
                              job={job}
                              onNavigateSearch={() =>
                                navigate(`/app/search?request=${job.id}&title=${encodeURIComponent(job.job_title)}`)
                              }
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <JobModal
          initial={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSaveModal}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Job"
        message={`Are you sure you want to delete "${deleteTarget?.job_title}"? This will also remove all shortlisted candidates for this job.`}
        confirmText="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
