import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, ExternalLink, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, AlertTriangle, Loader2, Download } from 'lucide-react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { SkeletonTable } from '../components/LoadingSkeleton'
import { browseContacts, fetchAllContactsForExport, type ContactsPage as ContactsPageData } from '../lib/dashboardService'
import { createContact, detectDuplicates, type Contact } from '../lib/candidateService'
import { supabase } from '../lib/supabaseClient'
import { exportContactsToCSV, downloadCSV } from '../lib/exportService'

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250]

// Build page number list with ellipsis: [1, '...', 4, 5, 6, '...', 24]
function buildPageList(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const pages: (number | '...')[] = []
  const addPage = (p: number) => { if (!pages.includes(p)) pages.push(p) }
  const addEllipsis = () => { if (pages[pages.length - 1] !== '...') pages.push('...') }

  addPage(0)
  if (current > 3) addEllipsis()
  for (let i = Math.max(1, current - 2); i <= Math.min(total - 2, current + 2); i++) addPage(i)
  if (current < total - 4) addEllipsis()
  addPage(total - 1)
  return pages
}

const SENIORITY_LEVELS = ['Intern','Junior','Mid','Senior','Lead','Manager','Director','VP','C-Suite']
const DEPARTMENTS = [
  'Architecture','Consulting','Data','Design','Education','Energy',
  'Engineering','Executive','Finance','Healthcare','Hospitality',
  'HR','Legal','Marketing','Operations','Product','Real Estate','Sales','Other',
]

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

type ContactRow = ContactsPageData['data'][0]

interface SourceMap {
  [contactId: string]: string[]
}

// ─── New Contact Modal ────────────────────────────────────────────────────────

function NewContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Contact) => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', current_title: '', contact_type: 'lead' as Contact['contact_type'] })
  const [duplicates, setDuplicates] = useState<Contact[]>([])
  const [checking,   setChecking]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [confirmed,  setConfirmed]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) { setError('First and last name required'); return }

    // Check for duplicates unless user already confirmed
    if (!confirmed) {
      setChecking(true)
      const dupes = await detectDuplicates({ email: form.email || null, first_name: form.first_name, last_name: form.last_name, phone: form.phone || null })
      setChecking(false)
      if (dupes.length) { setDuplicates(dupes); return }
    }

    setSaving(true)
    try {
      const created = await createContact({
        first_name:    form.first_name.trim(),
        last_name:     form.last_name.trim(),
        email:         form.email.trim()        || null,
        phone:         form.phone.trim()        || null,
        company:       form.company.trim()      || null,
        current_title: form.current_title.trim() || null,
        contact_type:  form.contact_type,
      })
      onCreated(created)
      onClose()
    } catch (err: any) { setError(err.message)
    } finally { setSaving(false) }
  }

  const inp = (key: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Duplicate warning */}
        {duplicates.length > 0 && !confirmed && (
          <div className="px-6 pt-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Possible duplicates found</span>
              </div>
              <div className="space-y-1 mb-3">
                {duplicates.map(d => (
                  <div key={d.id} className="text-xs text-yellow-700 bg-yellow-100 rounded px-2 py-1">
                    {d.first_name} {d.last_name} — {d.email ?? d.phone ?? d.company ?? 'no details'}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setConfirmed(true); setDuplicates([]) }} className="px-3 py-1.5 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700">Create anyway</button>
                <button onClick={() => setDuplicates([])} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800">Go back</button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {inp('first_name', 'First name *')}
            {inp('last_name',  'Last name *')}
            {inp('email',      'Email', 'email')}
            {inp('phone',      'Phone')}
            {inp('company',    'Company')}
            {inp('current_title', 'Title')}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select value={form.contact_type} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value as Contact['contact_type'] }))} className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="lead">Lead</option>
              <option value="candidate">Candidate</option>
              <option value="both">Both</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving || checking} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
              {(saving || checking) && <Loader2 size={14} className="animate-spin" />}
              {confirmed ? 'Create' : 'Check & Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const navigate = useNavigate()
  const [page, setPage]             = useState(0)
  const [pageSize, setPageSize]     = useState(50)
  const [search, setSearch]         = useState('')
  const [department, setDepartment] = useState('')
  const [seniority, setSeniority]   = useState('')
  const [company, setCompany]       = useState('')
  const [contactType, setContactType]       = useState('')
  const [candidateStatus, setCandidateStatus] = useState('')
  const [showModal, setShowModal]   = useState(false)

  const [contacts, setContacts]     = useState<ContactRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [sources, setSources]       = useState<SourceMap>({})
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [selectAllDB, setSelectAllDB] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)

  const debouncedSearch  = useDebounce(search, 300)
  const debouncedCompany = useDebounce(company, 300)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await browseContacts({
        page,
        pageSize,
        department:       department       || undefined,
        seniority:        seniority        || undefined,
        company:          debouncedCompany || undefined,
        search:           debouncedSearch  || undefined,
        contact_type:     contactType      || undefined,
        candidate_status: candidateStatus  || undefined,
      })
      setContacts(result.data)
      setTotalCount(result.count)

      // Batch-fetch source employees for this page
      const ids = result.data.map(c => c.id)
      if (ids.length) {
        const { data: src } = await supabase
          .from('contact_sources')
          .select('contact_id, employees(name)')
          .in('contact_id', ids)

        const map: SourceMap = {}
        for (const row of (src ?? []) as any[]) {
          const cid  = row.contact_id as string
          const name = row.employees?.name as string | undefined
          if (!name) continue
          if (!map[cid]) map[cid] = []
          map[cid]!.push(name)
        }
        setSources(map)
      } else {
        setSources({})
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, department, seniority, debouncedSearch, debouncedCompany, contactType, candidateStatus])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Reset to page 0 when filters or page size change
  useEffect(() => { setPage(0) }, [department, seniority, debouncedSearch, debouncedCompany, contactType, candidateStatus, pageSize])

  // Clear selection when page/filters change
  useEffect(() => { setSelected(new Set()); setSelectAllDB(false) }, [page, department, seniority, debouncedSearch, debouncedCompany, contactType, candidateStatus])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const clearFilters = () => {
    setSearch('')
    setDepartment('')
    setSeniority('')
    setCompany('')
    setContactType('')
    setCandidateStatus('')
    setPage(0)
  }

  const hasFilters = !!(search || department || seniority || company || contactType || candidateStatus)

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allPageSelected = contacts.length > 0 && contacts.every(c => selected.has(c.id))
  const somePageSelected = contacts.some(c => selected.has(c.id))

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        contacts.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        contacts.forEach(c => next.add(c.id))
        return next
      })
    }
  }

  const exportParams = {
    department:       department       || undefined,
    seniority:        seniority        || undefined,
    company:          debouncedCompany || undefined,
    search:           debouncedSearch  || undefined,
    contact_type:     contactType      || undefined,
    candidate_status: candidateStatus  || undefined,
  }

  const handleExportAll = async () => {
    setExportingAll(true)
    try {
      const all = await fetchAllContactsForExport(exportParams)
      const csv = exportContactsToCSV(all)
      const timestamp = new Date().toISOString().slice(0, 10)
      const suffix = hasFilters ? 'filtered' : 'all'
      downloadCSV(csv, `contacts-${suffix}-${timestamp}.csv`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setExportingAll(false)
    }
  }

  const handleExportSelected = async () => {
    if (selectAllDB) {
      await handleExportAll()
      return
    }
    const toExport = contacts.filter(c => selected.has(c.id))
    const csv = exportContactsToCSV(toExport)
    const timestamp = new Date().toISOString().slice(0, 10)
    downloadCSV(csv, `contacts-selected-${timestamp}.csv`)
  }

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Loading…' : `${totalCount.toLocaleString()} total contacts`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAll}
            disabled={exportingAll || loading}
            className="flex items-center gap-2 border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title={hasFilters ? `Export all ${totalCount.toLocaleString()} filtered contacts` : `Export all ${totalCount.toLocaleString()} contacts`}
          >
            {exportingAll ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Export All {!loading && totalCount > 0 && `(${totalCount.toLocaleString()})`}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={15} /> New Contact
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, title…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={department}
          onChange={e => setDepartment(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={seniority}
          onChange={e => setSeniority(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Seniority</option>
          {SENIORITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          value={company}
          onChange={e => setCompany(e.target.value)}
          placeholder="Filter by company…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={contactType}
          onChange={e => setContactType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Types</option>
          <option value="lead">Lead</option>
          <option value="candidate">Candidate</option>
          <option value="both">Both</option>
        </select>
        <select
          value={candidateStatus}
          onChange={e => setCandidateStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="do_not_contact">Do not contact</option>
          <option value="placed">Placed</option>
          <option value="blacklisted">Blacklisted</option>
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X size={14} /> Clear Filters
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          Showing {contacts.length} of {totalCount.toLocaleString()}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
      )}

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-800">
              {selectAllDB
                ? `All ${totalCount.toLocaleString()} contacts selected`
                : `${selected.size} contact${selected.size !== 1 ? 's' : ''} selected`}
            </span>
            <button
              onClick={handleExportSelected}
              disabled={exportingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {exportingAll ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export CSV
            </button>
            <button
              onClick={() => { setSelected(new Set()); setSelectAllDB(false) }}
              className="ml-auto text-sm text-blue-600 hover:text-blue-800"
            >
              Clear selection
            </button>
          </div>
          {/* Gmail-style: offer to select all in DB when full page is selected */}
          {allPageSelected && !selectAllDB && totalCount > contacts.length && (
            <p className="text-xs text-blue-700">
              All {contacts.length} contacts on this page are selected.{' '}
              <button
                onClick={() => setSelectAllDB(true)}
                className="underline font-medium hover:text-blue-900"
              >
                Select all {totalCount.toLocaleString()} contacts in the database
              </button>
            </p>
          )}
          {selectAllDB && (
            <p className="text-xs text-blue-700">
              All {totalCount.toLocaleString()} contacts are selected.{' '}
              <button
                onClick={() => setSelectAllDB(false)}
                className="underline font-medium hover:text-blue-900"
              >
                Select only this page instead
              </button>
            </p>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium w-8">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                    onChange={toggleSelectAll}
                    className="rounded"
                    title="Select all on this page"
                  />
                </th>
                <th className="px-4 py-3 font-medium w-8"></th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Normalized</th>
                <th className="px-4 py-3 font-medium">Seniority</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">LinkedIn</th>
                <th className="px-4 py-3 font-medium">Sources</th>
              </tr>
            </thead>
            {loading ? (
              <SkeletonTable rows={12} />
            ) : contacts.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      title="No contacts found"
                      description={hasFilters ? 'Try adjusting your filters' : 'Upload a CSV to add contacts'}
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {contacts.map(contact => {
                  const cat = contact.categorized_positions
                  const isExpanded = expanded.has(contact.id)
                  const contactSources = sources[contact.id] ?? []

                  return (
                    <>
                      <tr
                        key={contact.id}
                        onClick={() => navigate(`/app/contacts/${contact.id}`)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${selected.has(contact.id) ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(contact.id)}
                            onChange={() => toggleSelect(contact.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-400" onClick={e => { e.stopPropagation(); toggleExpand(contact.id) }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {contact.first_name} {contact.last_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{contact.company ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate text-xs">{contact.position_raw ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{cat?.normalized_title ?? '—'}</td>
                        <td className="px-4 py-3"><Badge value={cat?.seniority_level} variant="seniority" /></td>
                        <td className="px-4 py-3"><Badge value={cat?.department} variant="department" /></td>
                        <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate text-xs">{contact.email ?? '—'}</td>
                        <td className="px-4 py-3">
                          {contact.linkedin_url ? (
                            <a
                              href={contact.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <ExternalLink size={14} />
                            </a>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {contactSources.length > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                              {contactSources.length} employee{contactSources.length > 1 ? 's' : ''}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr key={`${contact.id}-expanded`} className="bg-blue-50 border-b border-blue-100">
                          <td colSpan={11} className="px-8 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Full Name</p>
                                <p className="font-medium text-gray-800">{contact.first_name} {contact.last_name}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                                <p className="text-gray-700">{contact.email ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Company</p>
                                <p className="text-gray-700">{contact.company ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Raw Position</p>
                                <p className="text-gray-700">{contact.position_raw ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Normalized Title</p>
                                <p className="text-gray-700">{cat?.normalized_title ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Seniority</p>
                                <Badge value={cat?.seniority_level} variant="seniority" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Department</p>
                                <Badge value={cat?.department} variant="department" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Connected On</p>
                                <p className="text-gray-700">{contact.connected_on ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">LinkedIn</p>
                                {contact.linkedin_url ? (
                                  <a href={contact.linkedin_url} target="_blank" rel="noreferrer"
                                    className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                                    View Profile <ExternalLink size={11} />
                                  </a>
                                ) : <span className="text-gray-400">—</span>}
                              </div>
                              {contactSources.length > 0 && (
                                <div className="col-span-full">
                                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Source Employees</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {contactSources.map(name => (
                                      <span key={name} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
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

      {/* Pagination */}
      {!loading && contacts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">

          {/* Page size selector */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Rows per page:</span>
            {PAGE_SIZE_OPTIONS.map(size => (
              <button
                key={size}
                onClick={() => setPageSize(size)}
                className={`px-2.5 py-1 rounded-lg border transition-colors ${
                  pageSize === size
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Page number buttons */}
          <div className="flex items-center gap-1">
            {/* First */}
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="First page"
            >
              <ChevronsLeft size={15} />
            </button>
            {/* Previous */}
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Prev
            </button>

            {/* Numbered pages */}
            {buildPageList(page, totalPages).map((p, i) =>
              p === '...'
                ? <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm select-none">…</span>
                : <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[32px] px-2 py-1.5 text-sm rounded-lg border transition-colors ${
                      page === p
                        ? 'bg-primary text-primary-foreground border-primary font-semibold'
                        : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {p + 1}
                  </button>
            )}

            {/* Next */}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
            {/* Last */}
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Last page"
            >
              <ChevronsRight size={15} />
            </button>
          </div>

          <p className="text-sm text-gray-400">
            Page {page + 1} of {totalPages} · {totalCount.toLocaleString()} total
          </p>
        </div>
      )}

      {showModal && (
        <NewContactModal
          onClose={() => setShowModal(false)}
          onCreated={c => {
            setContacts(prev => [c as unknown as ContactRow, ...prev])
            setTotalCount(t => t + 1)
          }}
        />
      )}
    </div>
  )
}
