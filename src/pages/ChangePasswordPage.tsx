/**
 * ChangePasswordPage — /change-password
 *
 * Forced password change for users invited via the password_email mode.
 * The user lands here on first login when user_metadata.must_change_password === true.
 * On success, clears the flag and redirects to the dashboard.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function ChangePasswordPage() {
  const navigate       = useNavigate()
  const [pwd,     setPwd]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [errMsg,  setErrMsg]  = useState('')
  const [done,    setDone]    = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pwd !== confirm) { setErrMsg('Passwords do not match'); return }
    if (pwd.length < 8)  { setErrMsg('Password must be at least 8 characters'); return }
    setErrMsg('')
    setSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: pwd,
        data: {
          must_change_password: false,
          password_changed_at:  new Date().toISOString(),
        },
      })

      if (error) {
        setErrMsg(error.message)
        setSubmitting(false)
        return
      }

      setDone(true)
      setTimeout(() => navigate('/app/dashboard', { replace: true }), 2000)
    } catch (err: any) {
      setErrMsg(err.message ?? 'Unexpected error')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white border border-green-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <CheckCircle2 size={40} className="text-green-500 mx-auto" />
          <h2 className="text-lg font-semibold text-gray-900">Password updated!</h2>
          <p className="text-sm text-gray-500">Redirecting to the dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm w-full max-w-md">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary">N</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Set your password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your account was set up with a temporary password. Please choose a new one to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">

          {/* New password */}
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
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
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
