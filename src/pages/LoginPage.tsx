import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lock, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode]         = useState<'login' | 'forgot'>('login')

  // Login state
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  // Forgot password state
  const [resetEmail, setResetEmail]   = useState('')
  const [resetSent, setResetSent]     = useState(false)
  const [resetError, setResetError]   = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)

  if (!authLoading && session) {
    return <Navigate to="/app/dashboard" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) {
        setError(authErr.message)
      } else {
        navigate('/app/dashboard', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setResetError(null)
    setResetLoading(true)
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/auth/reset-password`,
      })
      if (resetErr) {
        setResetError(resetErr.message)
      } else {
        setResetSent(true)
      }
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold mb-4">
            NF
          </span>
          <h1 className="text-2xl font-bold text-foreground">New Frontiers Talent</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === 'login' ? 'Sign in to your account' : 'Reset your password'}
          </p>
        </div>

        {mode === 'login' ? (
          <>
            {/* Sign-in form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-card border border-input text-foreground rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-foreground">Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setResetEmail(email); setResetSent(false); setResetError(null) }}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-card border border-input text-foreground rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-muted-foreground text-xs mt-6">
              Access is by invitation only. Contact your administrator.
            </p>
          </>
        ) : (
          <>
            {/* Forgot password form */}
            {resetSent ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center space-y-3">
                <CheckCircle2 size={32} className="text-primary mx-auto" />
                <p className="text-sm font-medium text-foreground">Check your email</p>
                <p className="text-xs text-muted-foreground">
                  We sent a password reset link to <strong>{resetEmail}</strong>. Check your inbox and follow the link.
                </p>
                <button
                  onClick={() => setMode('login')}
                  className="text-xs text-primary hover:underline mt-2"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Your email address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-card border border-input text-foreground rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                  </div>
                </div>

                {resetError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                    <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                    <p className="text-destructive text-sm">{resetError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-lg py-2.5 text-sm transition-colors"
                >
                  {resetLoading ? 'Sending…' : 'Send reset link'}
                </button>

                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={14} /> Back to sign in
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
