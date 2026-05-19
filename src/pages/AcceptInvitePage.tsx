/**
 * AcceptInvitePage — /auth/accept-invite
 *
 * Landing page for magic-link invitations.
 * Supabase redirects here after the user clicks the invite email link.
 * The URL hash contains the access + refresh tokens that Supabase JS picks up
 * automatically via onAuthStateChange. We just need to show a "set password" form.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

type Step = 'loading' | 'set-password' | 'done' | 'error'

export default function AcceptInvitePage() {
  const navigate  = useNavigate()
  const [step,    setStep]    = useState<Step>('loading')
  const [errMsg,  setErrMsg]  = useState('')
  const [name,    setName]    = useState('')
  const [pwd,     setPwd]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Supabase automatically exchanges the token in the URL hash.
  // Wait for the session to be established, then render the form.
  useEffect(() => {
    // hasSession: true once SIGNED_IN fires (prevents duplicate pre-fills)
    // done: true once USER_UPDATED fires (prevents duplicate completions)
    let hasSession = false
    let done       = false

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && !hasSession) {
        hasSession = true
        // Pre-fill name from invite metadata
        const meta = session.user?.user_metadata
        setName(meta?.full_name ?? '')
        setStep('set-password')
      }

      if (event === 'USER_UPDATED' && session && !done) {
        done = true
        // Mark the invitation as accepted
        const invId = session.user?.user_metadata?.invitation_id
        if (invId) {
          supabase.rpc('accept_invitation', { invitation_id: invId }).then(() => {})
        }
        setStep('done')
        setTimeout(() => navigate('/app/dashboard', { replace: true }), 2000)
      }
    })

    // If no session arrives within 6 seconds, the link is bad/expired
    const timer = setTimeout(() => {
      if (!hasSession) {
        setErrMsg('The invitation link has expired or is invalid. Ask your admin to resend the invite.')
        setStep('error')
      }
    }, 6000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [navigate])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwd !== confirm) { setErrMsg('Passwords do not match'); return }
    if (pwd.length < 8)  { setErrMsg('Password must be at least 8 characters'); return }
    setErrMsg('')
    setSubmitting(true)

    try {
      // Update name if changed
      const { data: { user } } = await supabase.auth.getUser()
      if (user && name.trim() && name.trim() !== user.user_metadata?.full_name) {
        await supabase.auth.updateUser({ data: { full_name: name.trim() } })
        await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id)
      }

      // Set the password — triggers USER_UPDATED event → step = 'done'
      const { error } = await supabase.auth.updateUser({ password: pwd })
      if (error) {
        setErrMsg(error.message)
        setSubmitting(false)
      }
      // If no error: USER_UPDATED will fire and advance the step.
      // As a fallback, stop the spinner after 8 s so the user isn't stuck.
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
          <p className="text-gray-500 text-sm">Verifying your invitation…</p>
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
          <h2 className="text-lg font-semibold text-gray-900">Invitation invalid</h2>
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
          <h2 className="text-lg font-semibold text-gray-900">You're all set!</h2>
          <p className="text-sm text-gray-500">Your password has been set. Redirecting to the dashboard…</p>
        </div>
      </div>
    )
  }

  // ── Set password form ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm w-full max-w-md">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary">N</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Welcome to New Frontiers Talent</h1>
          <p className="text-sm text-gray-500 mt-1">Set a password to complete your account setup</p>
        </div>

        <form onSubmit={handleSetPassword} className="px-8 py-6 space-y-4">

          {/* Full name (pre-filled from invite) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Choose a password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm password <span className="text-red-500">*</span>
            </label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
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
            {submitting ? 'Setting password…' : 'Set password & sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
