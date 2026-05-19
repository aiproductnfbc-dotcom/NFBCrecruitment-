/**
 * ResetPasswordPage — /auth/reset-password
 *
 * Landing page for Supabase password-reset emails.
 * Supabase redirects here with tokens in the URL hash after the user
 * clicks the "Reset password" link. Supabase JS automatically fires
 * a PASSWORD_RECOVERY event via onAuthStateChange which gives us a
 * session. We show a set-new-password form and call updateUser.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

type Step = 'loading' | 'set-password' | 'done' | 'error'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [step,      setStep]      = useState<Step>('loading')
  const [errMsg,    setErrMsg]    = useState('')
  const [pwd,       setPwd]       = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPwd,   setShowPwd]   = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Two separate flags — same pattern as AcceptInvitePage.
    // hasRecovery: set on PASSWORD_RECOVERY (shows the form)
    // done: set on USER_UPDATED (completes the flow)
    let hasRecovery = false
    let done        = false

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && !hasRecovery) {
        hasRecovery = true
        setStep('set-password')
      }
      if (event === 'USER_UPDATED' && !done) {
        done = true
        setStep('done')
        setTimeout(() => navigate('/login', { replace: true }), 2500)
      }
    })

    // Only show error if the recovery session never arrived at all
    const timer = setTimeout(() => {
      if (!hasRecovery) {
        setErrMsg('This reset link has expired or is invalid. Please request a new one.')
        setStep('error')
      }
    }, 6000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pwd !== confirm) { setErrMsg('Passwords do not match'); return }
    if (pwd.length < 8)  { setErrMsg('Password must be at least 8 characters'); return }
    setErrMsg('')
    setSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) {
        setErrMsg(error.message)
        setSubmitting(false)
      }
      // USER_UPDATED event fires → step = 'done'. Fallback: stop spinner after 8 s.
      setTimeout(() => setSubmitting(false), 8000)
    } catch (err: any) {
      setErrMsg(err.message ?? 'Unexpected error')
      setSubmitting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-primary mx-auto" />
          <p className="text-gray-500 text-sm">Verifying reset link…</p>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle size={40} className="text-red-400 mx-auto" />
          <h2 className="text-lg font-semibold text-gray-900">Link invalid or expired</h2>
          <p className="text-sm text-gray-500">{errMsg}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="mt-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  // ── Done ─────────────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white border border-green-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <CheckCircle2 size={40} className="text-green-500 mx-auto" />
          <h2 className="text-lg font-semibold text-gray-900">Password updated!</h2>
          <p className="text-sm text-gray-500">Redirecting to sign in…</p>
        </div>
      </div>
    )
  }

  // ── Set password form ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm w-full max-w-md">

        <div className="px-8 pt-8 pb-6 border-b border-gray-100 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary">N</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Set a new password</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a strong password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                placeholder="At least 8 characters"
                autoFocus
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm password <span className="text-red-500">*</span>
            </label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {errMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              {errMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Updating…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
