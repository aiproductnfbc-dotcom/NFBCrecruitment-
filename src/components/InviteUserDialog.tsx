import { useState } from 'react'
import { X, AlertTriangle, Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { inviteUser, type InviteRole, type InviteMode } from '../lib/inviteService'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose:   () => void
  onSuccess: (email: string) => void
}

// ── Role definitions ──────────────────────────────────────────────────────────

const ROLES: { slug: InviteRole; label: string; description: string }[] = [
  { slug: 'admin',           label: 'Admin',           description: 'Full access including user management' },
  { slug: 'account_manager', label: 'Account Manager', description: 'Manage clients, jobs and placements' },
  { slug: 'recruiter',       label: 'Recruiter',       description: 'Source candidates and manage pipeline' },
  { slug: 'viewer',          label: 'Viewer',          description: 'Read-only access to the database' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function InviteUserDialog({ onClose, onSuccess }: Props) {
  const [email,            setEmail]            = useState('')
  const [fullName,         setFullName]         = useState('')
  const [selectedRoles,    setSelectedRoles]    = useState<Set<InviteRole>>(new Set(['recruiter']))
  const [mode,             setMode]             = useState<InviteMode>('magic_link')
  const [autoGenPwd,       setAutoGenPwd]       = useState(true)
  const [manualPwd,        setManualPwd]        = useState('')
  const [showPwd,          setShowPwd]          = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const [error,            setError]            = useState<string | null>(null)
  const [fieldErrors,      setFieldErrors]      = useState<Record<string, string>>({})

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address'
    }
    if (!fullName.trim()) {
      errs.fullName = 'Full name is required'
    }
    if (selectedRoles.size === 0) {
      errs.roles = 'Select at least one role'
    }
    if (mode === 'password_email' && !autoGenPwd && manualPwd.length < 8) {
      errs.password = 'Password must be at least 8 characters'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const result = await inviteUser({
        email:                  email.trim(),
        full_name:              fullName.trim(),
        roles:                  [...selectedRoles],
        mode,
        auto_generate_password: mode === 'password_email' ? autoGenPwd : undefined,
        temporary_password:     mode === 'password_email' && !autoGenPwd ? manualPwd : undefined,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      onSuccess(email.trim())
    } catch (err: any) {
      setError(err.message ?? 'Unexpected error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Role toggle ─────────────────────────────────────────────────────────────

  function toggleRole(slug: InviteRole) {
    setSelectedRoles(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
    setFieldErrors(prev => ({ ...prev, roles: '' }))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invite New User</h2>
            <p className="text-xs text-gray-500 mt-0.5">They'll receive an email to set up their account</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })) }}
              placeholder="recruiter@newfrontiersbc.com"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                fieldErrors.email ? 'border-red-300 focus:ring-red-300' : 'border-gray-300'
              }`}
              autoFocus
            />
            {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
          </div>

          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setFieldErrors(p => ({ ...p, fullName: '' })) }}
              placeholder="Ayat Al-Something"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                fieldErrors.fullName ? 'border-red-300 focus:ring-red-300' : 'border-gray-300'
              }`}
            />
            {fieldErrors.fullName && <p className="text-xs text-red-500 mt-1">{fieldErrors.fullName}</p>}
          </div>

          {/* Roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roles <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {ROLES.map(role => (
                <label
                  key={role.slug}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedRoles.has(role.slug)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.has(role.slug)}
                    onChange={() => toggleRole(role.slug)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{role.label}</p>
                    <p className="text-xs text-gray-500">{role.description}</p>
                  </div>
                </label>
              ))}
            </div>
            {fieldErrors.roles && <p className="text-xs text-red-500 mt-1">{fieldErrors.roles}</p>}
          </div>

          {/* Invitation method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invitation method</label>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                mode === 'magic_link' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="mode"
                  value="magic_link"
                  checked={mode === 'magic_link'}
                  onChange={() => setMode('magic_link')}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Send magic link <span className="text-xs font-normal text-primary ml-1">Recommended</span></p>
                  <p className="text-xs text-gray-500">User receives a secure link and sets their own password</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                mode === 'password_email' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="mode"
                  value="password_email"
                  checked={mode === 'password_email'}
                  onChange={() => setMode('password_email')}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Set temporary password</p>
                  <p className="text-xs text-gray-500">Credentials emailed via Resend, forced change on first login</p>
                </div>
              </label>
            </div>

            {/* Password sub-panel */}
            {mode === 'password_email' && (
              <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2 text-amber-800">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    This sends a temporary password in plaintext email. Use only if magic link
                    isn't working. The user <strong>will be forced to change it</strong> on first login.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenPwd}
                    onChange={e => setAutoGenPwd(e.target.checked)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-1.5">
                    <RefreshCw size={13} className="text-gray-400" />
                    Auto-generate secure password
                  </span>
                </label>

                {!autoGenPwd && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Enter temporary password</label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={manualPwd}
                        onChange={e => { setManualPwd(e.target.value); setFieldErrors(p => ({ ...p, password: '' })) }}
                        placeholder="Min. 8 characters"
                        className={`w-full border rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary ${
                          fieldErrors.password ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Global error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
