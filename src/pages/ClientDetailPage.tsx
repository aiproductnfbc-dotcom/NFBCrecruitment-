import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, Globe, MapPin, Phone, Mail, ExternalLink,
  Plus, Pencil, Trash2, Star, StarOff, Loader2, X, Check, Briefcase,
} from 'lucide-react'
import ActivityTimeline from '../components/ActivityTimeline'
import { Skeleton } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import {
  getClientDetail, updateClient, deleteClient,
  createClientContact, updateClientContact, deleteClientContact, setPrimaryContact,
  type Client, type ClientContact, type ClientDetail,
} from '../lib/clientService'
import { supabase } from '../lib/supabaseClient'
import type { Job } from '../lib/jobService'

// ─── Helpers / Badges ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  prospect: 'bg-blue-100 text-blue-700',
  active:   'bg-green-100 text-green-700',
  on_hold:  'bg-yellow-100 text-yellow-700',
  churned:  'bg-red-100 text-red-700',
}
const TIER_BADGE: Record<string, string> = {
  A: 'bg-purple-100 text-purple-700',
  B: 'bg-indigo-100 text-indigo-700',
  C: 'bg-gray-100 text-gray-600',
}
const JOB_STATUS_BADGE: Record<string, string> = {
  open:    'bg-green-100 text-green-700',
  closed:  'bg-gray-100 text-gray-600',
  on_hold: 'bg-yellow-100 text-yellow-700',
}

function SBadge({ label, map }: { label: string; map: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>
      {label.replace('_', ' ')}
    </span>
  )
}

const STATUS_OPTIONS  = ['prospect', 'active', 'on_hold', 'churned'] as const
const TIER_OPTIONS    = ['A', 'B', 'C'] as const

// ─── Overview Tab ─────────────────────────────────────────────────────────────

interface OverviewTabProps {
  detail:    ClientDetail
  onUpdated: (c: Client) => void
}

function OverviewTab({ detail, onUpdated }: OverviewTabProps) {
  const { client, account_manager, open_jobs_count, total_jobs_count, last_activity_at } = detail
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState<Partial<Client>>({})
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const startEdit = () => {
    setForm({
      name:        client.name,
      legal_name:  client.legal_name,
      status:      client.status,
      tier:        client.tier,
      industry:    client.industry,
      website:     client.website,
      country:     client.country,
      city:        client.city,
      address:     client.address,
      size_bucket: client.size_bucket,
      source:      client.source,
      notes:       client.notes,
    })
    setEditing(true)
  }

  const handleSave = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      const updated = await updateClient(client.id, form)
      onUpdated(updated)
      setEditing(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-800">{value || <span className="text-gray-300">—</span>}</dd>
    </div>
  )

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {(['name', 'legal_name', 'industry', 'website', 'country', 'city', 'address', 'size_bucket', 'source'] as const).map(key => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1 capitalize">{key.replace('_', ' ')}</label>
              <input
                value={(form as any)[key] ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={form.status ?? 'prospect'}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as Client['status'] }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tier</label>
            <select
              value={form.tier ?? ''}
              onChange={e => setForm(f => ({ ...f, tier: (e.target.value as Client['tier']) || null }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">None</option>
              {TIER_OPTIONS.map(t => <option key={t} value={t}>Tier {t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea
            value={form.notes ?? ''}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}
            <Check size={14} /> Save
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={startEdit} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
          <Pencil size={14} /> Edit
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Open Jobs',         value: open_jobs_count },
          { label: 'Total Jobs',        value: total_jobs_count },
          { label: 'Status',            value: <SBadge label={client.status} map={STATUS_BADGE} /> },
          { label: 'Tier',              value: client.tier ? <SBadge label={client.tier} map={TIER_BADGE} /> : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-lg font-semibold text-gray-800 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Details */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {field('Legal name',  client.legal_name)}
        {field('Industry',    client.industry)}
        {field('Website',     client.website ? (
          <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
            {client.website} <ExternalLink size={12} />
          </a>
        ) : null)}
        {field('Country',     client.country)}
        {field('City',        client.city)}
        {field('Address',     client.address)}
        {field('Size',        client.size_bucket)}
        {field('Source',      client.source)}
        {field('Account manager', account_manager?.full_name ?? account_manager?.email)}
        {field('Last activity', last_activity_at
          ? new Date(last_activity_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : null
        )}
      </dl>

      {client.notes && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{client.notes}</p>
        </div>
      )}
    </div>
  )
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

interface ContactsTabProps {
  clientId:  string
  contacts:  ClientContact[]
  onChange:  (contacts: ClientContact[]) => void
}

function ContactsTab({ clientId, contacts, onChange }: ContactsTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [form,     setForm]     = useState<Partial<ClientContact>>({})
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const resetForm = () => { setForm({}); setError(null) }

  const startAdd = () => { resetForm(); setEditId(null); setShowForm(true) }
  const startEdit = (c: ClientContact) => { setForm(c); setEditId(c.id); setShowForm(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name?.trim() || !form.last_name?.trim()) {
      setError('First and last name are required'); return
    }
    setSaving(true)
    try {
      if (editId) {
        const updated = await updateClientContact(editId, form)
        onChange(contacts.map(c => c.id === editId ? updated : c))
      } else {
        const created = await createClientContact({
          client_id:    clientId,
          first_name:   form.first_name!.trim(),
          last_name:    form.last_name!.trim(),
          title:        form.title?.trim() || null,
          email:        form.email?.trim() || null,
          phone:        form.phone?.trim() || null,
          linkedin_url: form.linkedin_url?.trim() || null,
          is_primary:   form.is_primary ?? false,
          status:       form.status ?? 'active',
        })
        onChange([created, ...contacts])
      }
      resetForm()
      setShowForm(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return
    try {
      await deleteClientContact(id)
      onChange(contacts.filter(c => c.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleSetPrimary = async (id: string) => {
    try {
      await setPrimaryContact(clientId, id)
      onChange(contacts.map(c => ({ ...c, is_primary: c.id === id })))
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={startAdd} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
          <Plus size={14} /> Add contact
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {([['first_name', 'First name *'], ['last_name', 'Last name *'], ['title', 'Title'], ['email', 'Email'], ['phone', 'Phone'], ['linkedin_url', 'LinkedIn URL']] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  value={(form as any)[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  type={key === 'email' ? 'email' : 'text'}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_primary ?? false}
              onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))}
              className="rounded"
            />
            Set as primary contact
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {editId ? 'Save' : 'Add'}
            </button>
            <button type="button" onClick={() => { resetForm(); setShowForm(false) }} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          </div>
        </form>
      )}

      {!contacts.length ? (
        <EmptyState title="No contacts yet" description="Add a contact to get started" />
      ) : (
        <div className="divide-y divide-gray-100">
          {contacts.map(c => (
            <div key={c.id} className="py-3 flex items-start justify-between gap-4 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {c.first_name} {c.last_name}
                  </p>
                  {c.is_primary && (
                    <span className="text-xs text-yellow-600 font-medium bg-yellow-50 px-1.5 py-0.5 rounded">Primary</span>
                  )}
                </div>
                {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                <div className="flex gap-3 mt-1">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <Mail size={11} /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <Phone size={11} /> {c.phone}
                    </a>
                  )}
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <ExternalLink size={11} /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {!c.is_primary && (
                  <button onClick={() => handleSetPrimary(c.id)} title="Set as primary" className="p-1.5 text-gray-400 hover:text-yellow-500 rounded">
                    <Star size={14} />
                  </button>
                )}
                <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

interface JobsTabProps {
  clientId: string
}

function JobsTab({ clientId }: JobsTabProps) {
  const navigate = useNavigate()
  const [jobs,    setJobs]    = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('jobs')
      .select('id, job_title, department, seniority, status, created_at')
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setJobs((data ?? []) as Job[])
        setLoading(false)
      })
  }, [clientId])

  if (loading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  if (error)   return <p className="text-sm text-red-500">{error}</p>

  if (!jobs.length) {
    return <EmptyState icon={Briefcase} title="No jobs linked" description="Jobs with this client assigned will appear here" />
  }

  return (
    <div className="divide-y divide-gray-100">
      {jobs.map(j => (
        <div
          key={j.id}
          onClick={() => navigate(`/app/jobs/${j.id}`)}
          className="py-3 flex items-center justify-between gap-4 hover:bg-blue-50 cursor-pointer rounded px-2 -mx-2 transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">{j.job_title}</p>
            <p className="text-xs text-gray-400">
              {[j.department, j.seniority].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${JOB_STATUS_BADGE[j.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {j.status.replace('_', ' ')}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── ClientDetailPage ─────────────────────────────────────────────────────────

type Tab = 'overview' | 'contacts' | 'jobs' | 'activity'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'contacts',  label: 'Contacts' },
  { key: 'jobs',      label: 'Jobs' },
  { key: 'activity',  label: 'Activity' },
]

export default function ClientDetailPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const [detail,   setDetail]   = useState<ClientDetail | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [tab,      setTab]      = useState<Tab>('overview')
  const [deleting, setDeleting] = useState(false)

  const fetchDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const d = await getClientDetail(id)
      setDetail(d)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const handleDelete = async () => {
    if (!id || !confirm('Archive this client? This action can be undone.')) return
    setDeleting(true)
    try {
      await deleteClient(id)
      navigate('/app/clients', { replace: true })
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  if (error || !detail) {
    return <p className="text-sm text-red-500">{error ?? 'Client not found'}</p>
  }

  const { client } = detail

  return (
    <div className="max-w-5xl space-y-5">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/app/clients')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2">
            <ArrowLeft size={14} /> Clients
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
              <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                {client.industry && <span>{client.industry}</span>}
                {client.country  && <span className="flex items-center gap-1"><MapPin size={12} />{client.country}</span>}
                {client.website  && (
                  <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                    <Globe size={12} /> Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600 shrink-0"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Archive
        </button>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-primary text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.key === 'contacts' && detail.contacts.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5">{detail.contacts.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        {tab === 'overview' && (
          <OverviewTab
            detail={detail}
            onUpdated={updated => setDetail(d => d ? { ...d, client: updated } : d)}
          />
        )}
        {tab === 'contacts' && (
          <ContactsTab
            clientId={client.id}
            contacts={detail.contacts}
            onChange={contacts => setDetail(d => d ? { ...d, contacts } : d)}
          />
        )}
        {tab === 'jobs' && <JobsTab clientId={client.id} />}
        {tab === 'activity' && (
          <ActivityTimeline subjectType="client" subjectId={client.id} />
        )}
      </div>
    </div>
  )
}
