import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Users, ClipboardList, GitBranch,
  Shield, ShieldOff, ChevronUp, ChevronDown,
  Plus, CheckCircle, XCircle, ChevronRight,
  Mail, FileText, Plug, Eye, Pencil, Save, X,
  CheckCircle2, Clock, AlertCircle, Ban,
  UserPlus, RefreshCw, Trash2, KeyRound,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabaseClient'
import {
  listUsersWithRoles, assignRole, removeRole, setUserActive,
  listAuditLogs, listPipelineStagesAdmin, updateStageOrder,
  addPipelineStage, toggleStageActive,
  type UserWithRoles, type AuditLog, type PipelineStageAdmin,
} from '../lib/adminService'
import {
  listTemplates, getTemplate, updateTemplate, getEmailLog,
  type EmailTemplate, type EmailLogEntry, type EmailLogStatus,
} from '../lib/emailService'
import {
  listPendingInvitations, revokeInvitation, resendInvitation,
  type PendingInvitation,
} from '../lib/inviteService'
import InviteUserDialog from '../components/InviteUserDialog'

// ── Shared ───────────────────────────────────────────────────────────────────

const ALL_ROLES = [
  { slug: 'admin',           name: 'Admin' },
  { slug: 'account_manager', name: 'Account Manager' },
  { slug: 'recruiter',       name: 'Recruiter' },
  { slug: 'viewer',          name: 'Viewer' },
]

const ROLE_COLOR: Record<string, string> = {
  admin:           'bg-red-100 text-red-700',
  account_manager: 'bg-purple-100 text-purple-700',
  recruiter:       'bg-blue-100 text-blue-700',
  viewer:          'bg-gray-100 text-gray-600',
}

const ACTION_COLOR: Record<string, string> = {
  create:       'bg-green-100 text-green-700',
  update:       'bg-blue-100 text-blue-700',
  delete:       'bg-red-100 text-red-700',
  stage_change: 'bg-yellow-100 text-yellow-700',
  login:        'bg-slate-100 text-slate-600',
  export:       'bg-orange-100 text-orange-700',
}

const STAGE_TYPE_OPTIONS = [
  'sourced', 'screened', 'submitted', 'interview', 'offer', 'hired', 'rejected',
]

// ── Invitation status badge ───────────────────────────────────────────────────

const INV_STATUS_STYLE: Record<string, string> = {
  sent:     'bg-blue-100 text-blue-700',
  failed:   'bg-red-100 text-red-700',
  accepted: 'bg-green-100 text-green-700',
  expired:  'bg-gray-100 text-gray-500',
  revoked:  'bg-yellow-100 text-yellow-700',
}

// ── Tab: Users ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { user } = useAuth()
  const { toast: showToast } = useToast()
  const [users,       setUsers]       = useState<UserWithRoles[]>([])
  const [invites,     setInvites]     = useState<PendingInvitation[]>([])
  const [loading,     setLoading]     = useState(true)
  const [invLoading,  setInvLoading]  = useState(true)
  const [showInvite,  setShowInvite]  = useState(false)
  const [revoking,     setRevoking]     = useState<string | null>(null)
  const [resending,    setResending]    = useState<string | null>(null)
  const [resettingPwd, setResettingPwd] = useState<string | null>(null)
  const [resetLinkModal, setResetLinkModal] = useState<{ email: string; link: string } | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try { setUsers(await listUsersWithRoles()) }
    catch (e) { showToast((e as Error).message, 'error') }
    finally { setLoading(false) }
  }, [showToast])

  const loadInvites = useCallback(async () => {
    setInvLoading(true)
    try { setInvites(await listPendingInvitations()) }
    catch (e) { /* silently ignore — not critical */ }
    finally { setInvLoading(false) }
  }, [])

  useEffect(() => {
    loadUsers()
    loadInvites()
  }, [loadUsers, loadInvites])

  async function handleToggleRole(u: UserWithRoles, slug: string) {
    const has = u.roles.some(r => r.slug === slug)
    try {
      if (has) await removeRole(u.id, slug)
      else      await assignRole(u.id, slug)
      await loadUsers()
      showToast(has ? `Removed ${slug} from ${u.full_name ?? u.email}` : `Assigned ${slug} to ${u.full_name ?? u.email}`, 'success')
    } catch (e) { showToast((e as Error).message, 'error') }
  }

  async function handleSendPasswordReset(u: UserWithRoles) {
    if (!u.email) return
    setResettingPwd(u.id)
    try {
      // Use the edge function — it calls auth.admin.generateLink() which
      // bypasses the Supabase Site URL allowlist and always uses the
      // production APP_URL set as a Supabase secret.
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: u.email },
      })
      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null)
        throw new Error(body?.message ?? error.message)
      }
      if (data && !data.ok) throw new Error(data.message)
      if (data?.emailFailed && data?.link) {
        setResetLinkModal({ email: u.email!, link: data.link })
      } else {
        showToast(`Password reset email sent to ${u.email}`, 'success')
      }
    } catch (e) { showToast((e as Error).message, 'error') }
    finally { setResettingPwd(null) }
  }

  async function handleToggleActive(u: UserWithRoles) {
    try {
      await setUserActive(u.id, !u.is_active)
      await loadUsers()
      showToast(`${u.full_name ?? u.email} ${u.is_active ? 'deactivated' : 'activated'}`, 'success')
    } catch (e) { showToast((e as Error).message, 'error') }
  }

  async function handleRevoke(id: string) {
    setRevoking(id)
    try {
      await revokeInvitation(id)
      await loadInvites()
      showToast('Invitation revoked', 'success')
    } catch (e) { showToast((e as Error).message, 'error') }
    finally { setRevoking(null) }
  }

  async function handleResend(inv: PendingInvitation) {
    setResending(inv.id)
    try {
      const result = await resendInvitation(inv)
      if (!result.ok) throw new Error(result.message)
      await loadInvites()
      showToast(`Invite resent to ${inv.email}`, 'success')
    } catch (e) { showToast((e as Error).message, 'error') }
    finally { setResending(null) }
  }

  return (
    <div className="space-y-6">

      {/* ── Active Users ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{loading ? '…' : users.length} users</p>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <UserPlus size={14} />
            Invite user
          </button>
        </div>

        {loading
          ? <p className="text-sm text-gray-500 py-8 text-center">Loading users…</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 pr-4">User</th>
                    <th className="pb-2 pr-4">Roles</th>
                    <th className="pb-2 pr-4">Joined</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                    <tr key={u.id} className={u.is_active ? '' : 'opacity-50'}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900">{u.full_name ?? '—'}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>

                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {ALL_ROLES.map(role => {
                            const has = u.roles.some(r => r.slug === role.slug)
                            const isSelf = u.id === user?.id && role.slug === 'admin'
                            return (
                              <button
                                key={role.slug}
                                onClick={() => !isSelf && handleToggleRole(u, role.slug)}
                                disabled={isSelf}
                                title={isSelf ? 'Cannot remove your own admin role' : undefined}
                                className={`px-2 py-0.5 rounded text-xs font-medium border transition-opacity ${
                                  has
                                    ? `${ROLE_COLOR[role.slug]} border-transparent`
                                    : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                                } ${isSelf ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                              >
                                {role.name}
                              </button>
                            )
                          })}
                        </div>
                      </td>

                      <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSendPasswordReset(u)}
                            disabled={resettingPwd === u.id}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded border text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                            title="Send password reset email"
                          >
                            <KeyRound size={12} className={resettingPwd === u.id ? 'animate-pulse' : ''} />
                            Reset pwd
                          </button>
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                                u.is_active
                                  ? 'text-red-600 border-red-200 hover:bg-red-50'
                                  : 'text-green-600 border-green-200 hover:bg-green-50'
                              }`}
                            >
                              {u.is_active
                                ? <><ShieldOff size={12} /> Deactivate</>
                                : <><Shield size={12} /> Activate</>
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* ── Pending Invitations ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Pending Invitations</h3>
          <button
            onClick={loadInvites}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <RefreshCw size={11} />
            Refresh
          </button>
        </div>

        {invLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No pending invitations</p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Recipient</th>
                  <th className="px-4 py-2.5">Roles</th>
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5">Sent</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invites.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">{inv.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-500">{inv.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(inv.roles ?? []).map(r => (
                          <span key={r} className={`px-1.5 py-0.5 rounded text-xs font-medium ${ROLE_COLOR[r] ?? 'bg-gray-100 text-gray-600'}`}>
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {inv.mode === 'magic_link' ? 'Magic link' : 'Temp password'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(inv.sent_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INV_STATUS_STYLE[inv.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {inv.status}
                      </span>
                      {inv.error_message && (
                        <p className="text-xs text-red-500 mt-0.5 max-w-[160px] truncate" title={inv.error_message}>
                          {inv.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResend(inv)}
                          disabled={resending === inv.id}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40"
                          title="Resend invitation"
                        >
                          <RefreshCw size={11} className={resending === inv.id ? 'animate-spin' : ''} />
                          Resend
                        </button>
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revoking === inv.id}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                          title="Revoke invitation"
                        >
                          <Trash2 size={11} />
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Invite Dialog ─────────────────────────────────────────────────────── */}
      {showInvite && (
        <InviteUserDialog
          onClose={() => setShowInvite(false)}
          onSuccess={email => {
            setShowInvite(false)
            showToast(`Invitation sent to ${email}`, 'success')
            loadInvites()
            loadUsers()
          }}
        />
      )}

      {/* ── Reset Link Modal (shown when Resend domain not verified) ────────── */}
      {resetLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Email not sent — copy link manually</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Resend couldn't deliver to <strong>{resetLinkModal.email}</strong> because the sending domain isn't verified.
                  Copy this link and send it to them directly.
                </p>
              </div>
              <button onClick={() => setResetLinkModal(null)} className="text-gray-400 hover:text-gray-600 ml-4">
                <X size={18} />
              </button>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 break-all text-xs font-mono text-gray-700 select-all">
              {resetLinkModal.link}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setResetLinkModal(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(resetLinkModal.link)
                  showToast('Link copied to clipboard', 'success')
                }}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
              >
                Copy link
              </button>
            </div>

            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              To fix this permanently: verify your domain in <strong>resend.com/domains</strong>, then update the
              <code className="mx-1">INVITE_EMAIL_FROM</code> Supabase secret to use that domain.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── JSON Diff viewer ──────────────────────────────────────────────────────────

function JsonDiff({
  before, after,
}: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const allKeys = Array.from(new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])).sort()

  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="text-gray-500">
          <th className="text-left pr-3 pb-1 w-1/4">Field</th>
          <th className="text-left pr-3 pb-1 w-[37.5%]">Before</th>
          <th className="text-left pb-1 w-[37.5%]">After</th>
        </tr>
      </thead>
      <tbody>
        {allKeys.map(key => {
          const bVal = before?.[key]
          const aVal = after?.[key]
          const changed = JSON.stringify(bVal) !== JSON.stringify(aVal)
          return (
            <tr key={key} className={changed ? 'bg-yellow-50' : ''}>
              <td className="pr-3 py-0.5 text-gray-600 align-top">{key}</td>
              <td className={`pr-3 py-0.5 align-top ${changed ? 'text-red-600' : 'text-gray-500'}`}>
                {bVal === undefined ? <span className="text-gray-300">—</span>
                  : <span>{JSON.stringify(bVal)}</span>}
              </td>
              <td className={`py-0.5 align-top ${changed ? 'text-green-700' : 'text-gray-500'}`}>
                {aVal === undefined ? <span className="text-gray-300">—</span>
                  : <span>{JSON.stringify(aVal)}</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Tab: Audit Log ────────────────────────────────────────────────────────────

const ENTITY_TYPES = ['contacts', 'jobs', 'applications', 'clients', 'offers', 'placements']
const ACTIONS      = ['create', 'update', 'delete', 'stage_change', 'login', 'export']

function AuditTab() {
  const { toast: showToast } = useToast()
  const [logs, setLogs]           = useState<AuditLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [filterEntity, setFE]     = useState('')
  const [filterAction, setFA]     = useState('')
  const [filterFrom, setFF]       = useState('')
  const [filterTo, setFT]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAuditLogs({
        entityType: filterEntity || undefined,
        action:     filterAction || undefined,
        from:       filterFrom   || undefined,
        to:         filterTo     || undefined,
      })
      setLogs(data)
    } catch (e) { showToast((e as Error).message, 'error') }
    finally { setLoading(false) }
  }, [showToast, filterEntity, filterAction, filterFrom, filterTo])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Entity</label>
          <select
            value={filterEntity}
            onChange={e => setFE(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700 bg-white"
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Action</label>
          <select
            value={filterAction}
            onChange={e => setFA(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700 bg-white"
          >
            <option value="">All actions</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFF(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFT(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700"
          />
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90"
        >
          Apply
        </button>
        <button
          onClick={() => { setFE(''); setFA(''); setFF(''); setFT('') }}
          className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading audit log…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No audit entries found.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Who</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <>
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(e => e === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900 text-xs">
                        {log.actor?.full_name ?? log.actor?.email ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      <span className="font-medium">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="ml-1 text-gray-400 font-mono">{log.entity_id.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {(log.before_json || log.after_json) && (
                        <ChevronRight
                          size={14}
                          className={`text-gray-400 transition-transform ${expanded === log.id ? 'rotate-90' : ''}`}
                        />
                      )}
                    </td>
                  </tr>
                  {expanded === log.id && (log.before_json || log.after_json) && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={5} className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        <JsonDiff before={log.before_json} after={log.after_json} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Pipeline Stages ──────────────────────────────────────────────────────

function PipelineStagesTab() {
  const { toast: showToast } = useToast()
  const [stages, setStages]       = useState<PipelineStageAdmin[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [newName, setNewName]     = useState('')
  const [newType, setNewType]     = useState('screened')

  const load = useCallback(async () => {
    setLoading(true)
    try { setStages(await listPipelineStagesAdmin()) }
    catch (e) { showToast((e as Error).message, 'error') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { load() }, [load])

  async function move(index: number, direction: -1 | 1) {
    const next = [...stages]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= next.length) return
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    const reordered = next.map((s, i) => ({ ...s, order_index: i + 1 }))
    setStages(reordered)
    setSaving(true)
    try {
      await updateStageOrder(reordered.map(s => ({ id: s.id, order_index: s.order_index })))
      showToast('Order saved', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
      await load()
    } finally { setSaving(false) }
  }

  async function handleToggle(stage: PipelineStageAdmin) {
    try {
      await toggleStageActive(stage.id, !stage.is_active)
      await load()
      showToast(`Stage "${stage.name}" ${stage.is_active ? 'deactivated' : 'activated'}`, 'success')
    } catch (e) { showToast((e as Error).message, 'error') }
  }

  async function handleAdd() {
    if (!newName.trim()) return
    try {
      await addPipelineStage(newName.trim(), newType)
      setNewName('')
      setNewType('screened')
      setShowAdd(false)
      await load()
      showToast('Stage added', 'success')
    } catch (e) { showToast((e as Error).message, 'error') }
  }

  const STAGE_TYPE_COLOR: Record<string, string> = {
    sourced:   'bg-gray-100 text-gray-600',
    screened:  'bg-blue-100 text-blue-700',
    submitted: 'bg-indigo-100 text-indigo-700',
    interview: 'bg-yellow-100 text-yellow-700',
    offer:     'bg-purple-100 text-purple-700',
    hired:     'bg-green-100 text-green-700',
    rejected:  'bg-red-100 text-red-700',
  }

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Loading stages…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{stages.length} stages</p>
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          <Plus size={14} /> Add Stage
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 items-end p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Stage name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Technical Screen"
              className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Type</label>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
            >
              {STAGE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90"
          >
            Add
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2 w-8">#</th>
              <th className="px-4 py-2">Stage</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stages.map((stage, idx) => (
              <tr key={stage.id} className={stage.is_active ? '' : 'opacity-40'}>
                <td className="px-4 py-2 text-gray-400 text-xs">{stage.order_index}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-gray-900">{stage.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{stage.slug}</div>
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_TYPE_COLOR[stage.stage_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {stage.stage_type}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleToggle(stage)}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
                      stage.is_active
                        ? 'text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                        : 'text-gray-400 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                    }`}
                  >
                    {stage.is_active
                      ? <><CheckCircle size={12} /> Active</>
                      : <><XCircle size={12} /> Inactive</>
                    }
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === stages.length - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Email Templates ──────────────────────────────────────────────────────

const LOG_STATUS_STYLE: Record<EmailLogStatus, string> = {
  queued:  'bg-yellow-100 text-yellow-700',
  sent:    'bg-green-100 text-green-700',
  failed:  'bg-red-100 text-red-700',
  bounced: 'bg-orange-100 text-orange-700',
}
const LOG_STATUS_ICON: Record<EmailLogStatus, React.ElementType> = {
  queued:  Clock,
  sent:    CheckCircle2,
  failed:  AlertCircle,
  bounced: Ban,
}

function EmailTemplatesTab() {
  const { toast: showToast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<EmailTemplate | null>(null)
  const [form, setForm]           = useState<Partial<EmailTemplate>>({})
  const [saving, setSaving]       = useState(false)
  const [preview, setPreview]     = useState<EmailTemplate | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setTemplates(await listTemplates()) }
    catch (e) { showToast((e as Error).message, 'error') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { load() }, [load])

  function startEdit(t: EmailTemplate) {
    setForm({ name: t.name, subject: t.subject, body_html: t.body_html, body_text: t.body_text ?? '' })
    setEditing(t)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      await updateTemplate(editing.id, {
        name:      form.name      ?? editing.name,
        subject:   form.subject   ?? editing.subject,
        body_html: form.body_html ?? editing.body_html,
        body_text: form.body_text ?? null,
      })
      showToast('Template saved', 'success')
      setEditing(null)
      await load()
    } catch (e) { showToast((e as Error).message, 'error') }
    finally { setSaving(false) }
  }

  // Simple preview: replace all {{var}} with <var> for display
  function previewHtml(tpl: EmailTemplate) {
    return tpl.body_html.replace(/\{\{(\w+)\}\}/g, '<span style="background:#fef08a;padding:0 2px">$1</span>')
  }

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Loading templates…</p>

  return (
    <div className="space-y-4">
      {editing ? (
        /* Edit form */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">{editing.name}</h3>
            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Template name</label>
            <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Subject</label>
            <input value={form.subject ?? ''} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">HTML body</label>
              <span className="text-xs text-gray-400">Variables: {editing.variables_json.map(v => `{{${v}}}`).join(', ')}</span>
            </div>
            <textarea
              value={form.body_html ?? ''}
              onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
              rows={12}
              className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-mono resize-y"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Plain text body (optional)</label>
            <textarea
              value={form.body_text ?? ''}
              onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))}
              rows={6}
              className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-mono resize-y"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:opacity-50">
              <Save size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : preview ? (
        /* Preview modal-like inline view */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Preview: {preview.name}</h3>
            <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <p className="text-sm text-gray-600"><strong>Subject:</strong> {preview.subject}</p>
          <p className="text-xs text-gray-400">Variables highlighted in yellow</p>
          <div
            className="border border-gray-200 rounded p-4 bg-white text-sm overflow-auto max-h-[500px]"
            dangerouslySetInnerHTML={{ __html: previewHtml(preview) }}
          />
          <div className="flex items-center gap-2 flex-wrap">
            {preview.variables_json.map(v => (
              <span key={v} className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded font-mono">{`{{${v}}}`}</span>
            ))}
          </div>
        </div>
      ) : (
        /* List */
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Slug</th>
                <th className="px-4 py-2">Variables</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map(t => (
                <tr key={t.id} className={t.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{t.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {t.variables_json.map(v => (
                        <span key={v} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">{`{{${v}}}`}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(t.updated_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setPreview(t)}
                        className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 text-gray-600 rounded hover:bg-gray-50">
                        <Eye size={11} /> Preview
                      </button>
                      <button onClick={() => startEdit(t)}
                        className="flex items-center gap-1 text-xs px-2 py-1 border border-blue-200 text-blue-600 rounded hover:bg-blue-50">
                        <Pencil size={11} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Email Log ────────────────────────────────────────────────────────────

const EMAIL_LOG_STATUSES: Array<EmailLogStatus | ''> = ['', 'queued', 'sent', 'failed', 'bounced']

function EmailLogTab() {
  const { toast: showToast } = useToast()
  const [logs, setLogs]         = useState<EmailLogEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterStatus, setFS]   = useState<EmailLogStatus | ''>('')
  const [filterEntity, setFE]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLogs(await getEmailLog({
        status:            filterStatus    || undefined,
        relatedEntityType: filterEntity    || undefined,
      }))
    } catch (e) { showToast((e as Error).message, 'error') }
    finally { setLoading(false) }
  }, [showToast, filterStatus, filterEntity])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select value={filterStatus} onChange={e => setFS(e.target.value as EmailLogStatus | '')}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white">
            {EMAIL_LOG_STATUSES.map(s => <option key={s} value={s}>{s === '' ? 'All statuses' : s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Entity type</label>
          <select value={filterEntity} onChange={e => setFE(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white">
            <option value="">All</option>
            {['applications','offers','contacts','jobs'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={load}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90">
          Apply
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading email log…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No emails logged yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2">To</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Template</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Sent by</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => {
                const StatusIcon = LOG_STATUS_ICON[log.status]
                return (
                  <>
                    <tr key={log.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpanded(e => e === log.id ? null : log.id)}>
                      <td className="px-4 py-2 text-xs text-gray-700">{log.to_email}</td>
                      <td className="px-4 py-2 text-xs text-gray-900 max-w-[200px] truncate">{log.subject}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 font-mono">{log.template?.slug ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${LOG_STATUS_STYLE[log.status]}`}>
                          <StatusIcon size={10} /> {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {log.sender?.full_name ?? log.sender?.email ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <ChevronRight size={13} className={`text-gray-400 transition-transform ${expanded === log.id ? 'rotate-90' : ''}`} />
                      </td>
                    </tr>
                    {expanded === log.id && (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={7} className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs">
                          {log.error_message && (
                            <div className="mb-2 p-2 bg-red-50 text-red-700 rounded font-mono">
                              Error: {log.error_message}
                            </div>
                          )}
                          {log.related_entity_type && (
                            <p className="mb-2 text-gray-500">
                              Entity: <span className="font-medium">{log.related_entity_type}</span>
                              {log.related_entity_id && <span className="font-mono ml-1">{log.related_entity_id.slice(0, 8)}…</span>}
                            </p>
                          )}
                          <div className="border border-gray-200 rounded p-3 bg-white max-h-60 overflow-auto">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap">{log.body}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Integrations ─────────────────────────────────────────────────────────

const INTEGRATION_CARDS = [
  {
    provider: 'resend',
    name:     'Resend',
    desc:     'Transactional email provider. Set RESEND_API_KEY and RESEND_FROM_EMAIL as Supabase secrets.',
    docsUrl:  'https://resend.com/docs',
    live:     true,
  },
  {
    provider: 'google_calendar',
    name:     'Google Calendar',
    desc:     'Sync interview events to recruiters\' calendars via OAuth.',
    docsUrl:  null,
    live:     false,
  },
  {
    provider: 'linkedin',
    name:     'LinkedIn',
    desc:     'Import candidates from LinkedIn Recruiter.',
    docsUrl:  null,
    live:     false,
  },
  {
    provider: 'indeed',
    name:     'Indeed',
    desc:     'Post jobs directly to Indeed and import applicants.',
    docsUrl:  null,
    live:     false,
  },
]

function IntegrationsTab() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {INTEGRATION_CARDS.map(card => (
        <div key={card.provider}
          className={`border rounded-xl p-5 space-y-3 ${card.live ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{card.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{card.desc}</p>
            </div>
            {card.live ? (
              <span className="shrink-0 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Available</span>
            ) : (
              <span className="shrink-0 text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full">Coming soon</span>
            )}
          </div>

          {card.provider === 'resend' && (
            <div className="text-xs text-gray-600 space-y-1 bg-white border border-blue-100 rounded-lg p-3 font-mono">
              <p className="font-sans font-medium text-gray-700 mb-2 not-italic">Setup instructions:</p>
              <p>1. Create account at resend.com</p>
              <p>2. Generate an API key</p>
              <p className="text-blue-600">supabase secrets set RESEND_API_KEY=re_...</p>
              <p className="text-blue-600">supabase secrets set RESEND_FROM_EMAIL=noreply@yourdomain.com</p>
              <p>3. Deploy the send-email edge function</p>
              <p className="text-blue-600">supabase functions deploy send-email</p>
              <p>4. Verify your domain in the Resend dashboard</p>
            </div>
          )}

          {!card.live && (
            <p className="text-xs text-gray-400 italic">
              OAuth-based integration — schema registered, implementation pending.
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'users' | 'audit' | 'stages' | 'email_templates' | 'email_log' | 'integrations'

const TABS_SYSTEM: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'users',  label: 'Users',          icon: Users },
  { id: 'audit',  label: 'Audit Log',      icon: ClipboardList },
  { id: 'stages', label: 'Pipeline',       icon: GitBranch },
]
const TABS_COMMS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'email_templates', label: 'Templates',    icon: FileText },
  { id: 'email_log',       label: 'Email Log',    icon: Mail },
  { id: 'integrations',    label: 'Integrations', icon: Plug },
]

export default function AdminPage() {
  const { roles } = useAuth()
  const [tab, setTab] = useState<Tab>('users')

  if (!roles.includes('admin')) {
    return <Navigate to="/app/dashboard" replace />
  }

  function TabButton({ id, label, icon: Icon }: { id: Tab; label: string; icon: React.ElementType }) {
    return (
      <button
        onClick={() => setTab(id)}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
          tab === id
            ? 'border-primary text-accent-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <Icon size={15} />
        {label}
      </button>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Manage users, audit logs, pipeline, and communications.</p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex items-center gap-0 overflow-x-auto">
          {/* System group */}
          {TABS_SYSTEM.map(t => <TabButton key={t.id} {...t} />)}

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200 mx-2 shrink-0" />

          {/* Communications group */}
          {TABS_COMMS.map(t => <TabButton key={t.id} {...t} />)}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {tab === 'users'           && <UsersTab />}
        {tab === 'audit'           && <AuditTab />}
        {tab === 'stages'          && <PipelineStagesTab />}
        {tab === 'email_templates' && <EmailTemplatesTab />}
        {tab === 'email_log'       && <EmailLogTab />}
        {tab === 'integrations'    && <IntegrationsTab />}
      </div>
    </div>
  )
}
