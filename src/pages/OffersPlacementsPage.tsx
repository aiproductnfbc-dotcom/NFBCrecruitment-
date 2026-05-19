import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HandshakeIcon, DollarSign, FileText, CheckCircle2, XCircle,
  Clock, AlertCircle, Loader2, RefreshCcw, ExternalLink, ShieldOff,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Skeleton } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import {
  listOffers, updateOfferStatus,
  type Offer, type OfferStatus,
} from '../lib/offerService'
import { sendTemplatedEmail } from '../lib/emailService'
import {
  listPlacements, updateInvoiceStatus,
  type Placement, type InvoiceStatus,
} from '../lib/placementService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(amount: number | null | undefined, currency = 'USD') {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount)
}

// ── Offer Status Config ───────────────────────────────────────────────────────

const OFFER_STATUS_STYLE: Record<OfferStatus, string> = {
  draft:     'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  accepted:  'bg-green-100 text-green-700',
  declined:  'bg-red-100 text-red-700',
  withdrawn: 'bg-orange-100 text-orange-700',
  expired:   'bg-gray-200 text-gray-500',
}

const INVOICE_STATUS_STYLE: Record<InvoiceStatus, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  invoiced: 'bg-blue-100 text-blue-700',
  paid:     'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
}

// ── Decline Modal ─────────────────────────────────────────────────────────────

function DeclineModal({
  offer,
  onConfirm,
  onClose,
}: {
  offer: Offer
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Decline Offer</h3>
        <p className="text-sm text-gray-500 mb-4">
          {(offer.application?.contact as any)?.first_name} {(offer.application?.contact as any)?.last_name}
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Reason for declining…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Offers Tab ────────────────────────────────────────────────────────────────

function OffersTab() {
  const { toast } = useToast()
  const navigate  = useNavigate()
  const [offers,   setOffers]  = useState<Offer[]>([])
  const [loading,  setLoading] = useState(true)
  const [filter,   setFilter]  = useState<OfferStatus | ''>('')
  const [acting,   setActing]  = useState<string | null>(null)
  const [decline,  setDecline] = useState<Offer | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listOffers(filter ? { status: filter as OfferStatus } : undefined)
      setOffers(data)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useEffect(() => { load() }, [load])

  const act = async (
    offerId: string,
    status: OfferStatus,
    opts?: Parameters<typeof updateOfferStatus>[2]
  ) => {
    setActing(offerId)
    try {
      const updated = await updateOfferStatus(offerId, status, opts)
      setOffers(prev => prev.map(o => o.id === offerId ? { ...o, ...updated } : o))
      toast(`Offer ${status}`, 'success')

      // Send offer letter email when offer is sent to candidate
      if (status === 'sent') {
        const offer   = offers.find(o => o.id === offerId)
        const contact = offer?.application?.contact
        const job     = offer?.application?.job as any
        if (contact?.email) {
          sendTemplatedEmail('offer_letter', {
            candidate_name: `${contact.first_name} ${contact.last_name}`.trim(),
            job_title:      job?.job_title ?? '',
            salary:         offer?.salary != null ? fmtMoney(offer.salary, offer.currency) : 'TBD',
            start_date:     offer?.start_date ? fmtDate(offer.start_date) : 'TBD',
            company_name:   job?.client?.name ?? '',
          }, contact.email, {
            relatedEntityType: 'offer',
            relatedEntityId:   offerId,
          }).catch(() => {})
        }
      }

      if (status === 'accepted') load() // reload to include placement
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setActing(null)
    }
  }

  const handleDeclineConfirm = async (reason: string) => {
    if (!decline) return
    const d = decline
    setDecline(null)
    await act(d.id, 'declined', { decline_reason: reason })
  }

  const STATUS_FILTERS: Array<OfferStatus | ''> = ['', 'draft', 'sent', 'accepted', 'declined', 'withdrawn', 'expired']

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : offers.length === 0 ? (
        <EmptyState title="No offers" description="Offers are created when a candidate reaches the Offer stage" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Candidate</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Salary</th>
                <th className="px-4 py-3 font-medium">Start Date</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.map(offer => {
                const contact = offer.application?.contact as any
                const job     = offer.application?.job as any
                const isActing = acting === offer.id

                return (
                  <tr key={offer.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">
                        {contact?.first_name} {contact?.last_name}
                      </p>
                      {contact?.email && (
                        <p className="text-xs text-gray-400">{contact.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {job ? (
                        <button
                          onClick={() => navigate(`/app/jobs/${job.id}`)}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {job.job_title} <ExternalLink size={11} />
                        </button>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {fmtMoney(offer.salary, offer.currency)}
                      {offer.bonus != null && (
                        <p className="text-xs text-gray-400">+{fmtMoney(offer.bonus, offer.currency)} bonus</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(offer.start_date)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(offer.offer_expires_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${OFFER_STATUS_STYLE[offer.status]}`}>
                        {offer.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isActing ? (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      ) : (
                        <div className="flex items-center gap-2">
                          {offer.status === 'draft' && (
                            <button
                              onClick={() => act(offer.id, 'sent')}
                              className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                            >
                              Send
                            </button>
                          )}
                          {offer.status === 'sent' && (
                            <>
                              <button
                                onClick={() => act(offer.id, 'accepted')}
                                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => setDecline(offer)}
                                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {(offer.status === 'draft' || offer.status === 'sent') && (
                            <button
                              onClick={() => act(offer.id, 'withdrawn')}
                              className="text-xs text-gray-400 hover:text-gray-700"
                              title="Withdraw"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {decline && (
        <DeclineModal
          offer={decline}
          onConfirm={handleDeclineConfirm}
          onClose={() => setDecline(null)}
        />
      )}
    </div>
  )
}

// ── Placements Tab ────────────────────────────────────────────────────────────

function PlacementsTab() {
  const { isAdmin, isAccountManager } = useAuth()
  const { toast }   = useToast()
  const navigate    = useNavigate()

  const [placements, setPlacements] = useState<Placement[]>([])
  const [loading,   setLoading]    = useState(true)
  const [filter,    setFilter]     = useState<InvoiceStatus | ''>('')
  const [acting,    setActing]     = useState<string | null>(null)

  // All hooks must be above this guard (Rules of Hooks)
  if (!isAdmin && !isAccountManager) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
        <ShieldOff size={32} />
        <p className="text-sm font-medium">Access restricted</p>
        <p className="text-xs">Placement and fee data is visible to account managers and admins only.</p>
      </div>
    )
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listPlacements(filter ? { invoice_status: filter as InvoiceStatus } : undefined)
      setPlacements(data)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useEffect(() => { load() }, [load])

  const updateInvoice = async (placementId: string, status: InvoiceStatus) => {
    setActing(placementId)
    try {
      const updated = await updateInvoiceStatus(placementId, status)
      setPlacements(prev => prev.map(p => p.id === placementId ? updated : p))
      toast(`Marked as ${status}`, 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setActing(null)
    }
  }

  const INVOICE_FILTERS: Array<InvoiceStatus | ''> = ['', 'pending', 'invoiced', 'paid', 'disputed']

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {INVOICE_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : placements.length === 0 ? (
        <EmptyState title="No placements" description="Placements are created when an offer is accepted" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Candidate</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">Guarantee</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {placements.map(pl => {
                const contact = pl.contact
                const job     = pl.job
                const client  = pl.client
                const isActing = acting === pl.id
                const guaranteeExpired = pl.guarantee_expires_at
                  ? new Date(pl.guarantee_expires_at) < new Date()
                  : false

                return (
                  <tr key={pl.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {contact ? (
                        <button
                          onClick={() => navigate(`/app/contacts/${contact.id}`)}
                          className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {contact.first_name} {contact.last_name}
                          <ExternalLink size={11} />
                        </button>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {job ? (
                        <button
                          onClick={() => navigate(`/app/jobs/${job.id}`)}
                          className="text-sm text-gray-700 hover:text-blue-600 text-left"
                        >
                          {job.job_title}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{client?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {fmtMoney(pl.fee_amount, pl.currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(pl.start_date)}</td>
                    <td className="px-4 py-3">
                      {pl.guarantee_expires_at ? (
                        <span className={`text-xs ${guaranteeExpired ? 'text-gray-400' : 'text-green-600 font-medium'}`}>
                          {guaranteeExpired ? 'Expired' : fmtDate(pl.guarantee_expires_at)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_STYLE[pl.invoice_status]}`}>
                        {pl.invoice_status}
                      </span>
                      {pl.invoiced_at && (
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(pl.invoiced_at)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isActing ? (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {pl.invoice_status === 'pending' && (
                            <button
                              onClick={() => updateInvoice(pl.id, 'invoiced')}
                              className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                            >
                              Invoice
                            </button>
                          )}
                          {pl.invoice_status === 'invoiced' && (
                            <button
                              onClick={() => updateInvoice(pl.id, 'paid')}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Mark Paid
                            </button>
                          )}
                          {(pl.invoice_status !== 'paid' && pl.invoice_status !== 'disputed') && (
                            <button
                              onClick={() => updateInvoice(pl.id, 'disputed')}
                              className="text-xs text-orange-400 hover:text-orange-600"
                              title="Mark as disputed"
                            >
                              <AlertCircle size={14} />
                            </button>
                          )}
                          {pl.invoice_status === 'disputed' && (
                            <button
                              onClick={() => updateInvoice(pl.id, 'invoiced')}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                            >
                              Re-invoice
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OffersPlacementsPage() {
  const [tab, setTab] = useState<'offers' | 'placements'>('offers')

  return (
    <div className="space-y-5 max-w-full">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Offers & Placements</h2>
        <p className="text-gray-500 text-sm mt-1">Track compensation offers and successful placements</p>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          <button
            onClick={() => setTab('offers')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'offers'
                ? 'border-primary text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText size={14} /> Offers
          </button>
          <button
            onClick={() => setTab('placements')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'placements'
                ? 'border-primary text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckCircle2 size={14} /> Placements
          </button>
        </nav>
      </div>

      {tab === 'offers'     && <OffersTab />}
      {tab === 'placements' && <PlacementsTab />}
    </div>
  )
}
