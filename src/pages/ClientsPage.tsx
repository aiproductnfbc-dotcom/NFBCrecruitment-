import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, Plus, Search, X, Loader2 } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { Skeleton } from '../components/LoadingSkeleton'
import { getClients, createClient, type Client } from '../lib/clientService'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const STATUS_OPTIONS  = ['prospect', 'active', 'on_hold', 'churned'] as const
const TIER_OPTIONS    = ['A', 'B', 'C'] as const

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-gray-300">—</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIER_BADGE[tier] ?? 'bg-gray-100 text-gray-600'}`}>
      Tier {tier}
    </span>
  )
}

// ─── New Client Modal ─────────────────────────────────────────────────────────

interface NewClientModalProps {
  onClose:   () => void
  onCreated: (c: Client) => void
}

function NewClientModal({ onClose, onCreated }: NewClientModalProps) {
  const [name,    setName]    = useState('')
  const [status,  setStatus]  = useState<Client['status']>('prospect')
  const [tier,    setTier]    = useState<Client['tier']>(null)
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      const client = await createClient({
        name:     name.trim(),
        status,
        tier:     tier || null,
        industry: industry.trim() || null,
        website:  website.trim() || null,
      })
      onCreated(client)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Company name"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as Client['status'])}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
              <select
                value={tier ?? ''}
                onChange={e => setTier((e.target.value as Client['tier']) || null)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">None</option>
                {TIER_OPTIONS.map(t => <option key={t} value={t}>Tier {t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <input
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="e.g. Technology"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── ClientsPage ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function ClientsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Filter state — synced to URL params
  const [search,   setSearch]   = useState(searchParams.get('q') ?? '')
  const [statuses, setStatuses] = useState<string[]>(searchParams.getAll('status'))
  const [tiers,    setTiers]    = useState<string[]>(searchParams.getAll('tier'))
  const [industry, setIndustry] = useState(searchParams.get('industry') ?? '')
  const [page,     setPage]     = useState(0)
  const [showModal, setShowModal] = useState(false)

  const [clients,   setClients]   = useState<Client[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const debouncedSearch   = useDebounce(search,   300)
  const debouncedIndustry = useDebounce(industry, 300)

  // Sync filters to URL params
  useEffect(() => {
    const p = new URLSearchParams()
    if (debouncedSearch)   p.set('q', debouncedSearch)
    if (debouncedIndustry) p.set('industry', debouncedIndustry)
    statuses.forEach(s => p.append('status', s))
    tiers.forEach(t => p.append('tier', t))
    setSearchParams(p, { replace: true })
    setPage(0)
  }, [debouncedSearch, debouncedIndustry, statuses, tiers]) // eslint-disable-line

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getClients({
        search:   debouncedSearch   || undefined,
        industry: debouncedIndustry || undefined,
        status:   statuses.length   ? statuses : undefined,
        tier:     tiers.length      ? tiers    : undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setClients(result.data)
      setTotal(result.count)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, debouncedIndustry, statuses, tiers, page])

  useEffect(() => { fetchClients() }, [fetchClients])

  const toggleStatus = (s: string) =>
    setStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const toggleTier = (t: string) =>
    setTiers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = !!(debouncedSearch || debouncedIndustry || statuses.length || tiers.length)

  const clearFilters = () => { setSearch(''); setIndustry(''); setStatuses([]); setTiers([]) }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? '…' : `${total.toLocaleString()} client${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> New Client
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        {/* Search + industry */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <input
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            placeholder="Industry"
            className="w-44 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">Status:</span>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                statuses.includes(s)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
          <span className="text-xs text-gray-500 font-medium ml-2">Tier:</span>
          {TIER_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => toggleTier(t)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                tiers.includes(t)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              Tier {t}
            </button>
          ))}
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 ml-2">
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-500">{error}</div>
        ) : !clients.length ? (
          <EmptyState
            icon={Building2}
            title={hasFilters ? 'No clients match your filters' : 'No clients yet'}
            description={hasFilters ? 'Try adjusting the filters above' : 'Click "New Client" to add your first client'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Country</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/app/clients/${c.id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.name}
                      {c.legal_name && c.legal_name !== c.name && (
                        <span className="text-gray-400 font-normal ml-1 text-xs">({c.legal_name})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.industry ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3"><TierBadge tier={c.tier} /></td>
                    <td className="px-4 py-3 text-gray-500">{c.country ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <NewClientModal
          onClose={() => setShowModal(false)}
          onCreated={c => {
            setClients(prev => [c, ...prev])
            setTotal(t => t + 1)
          }}
        />
      )}
    </div>
  )
}
