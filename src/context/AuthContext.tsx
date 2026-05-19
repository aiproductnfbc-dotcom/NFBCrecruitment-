import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { User, Session } from '@supabase/supabase-js'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_active: boolean
}

interface AuthContextValue {
  session:          Session | null
  user:             User | null
  profile:          Profile | null
  roles:            string[]
  isAdmin:          boolean
  isAccountManager: boolean
  hasRole:          (slug: string) => boolean
  loading:          boolean
  signOut:          () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles]     = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const doSignOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  async function loadProfile(userId: string) {
    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, is_active')
          .eq('id', userId)
          .single(),
        supabase
          .from('my_roles')
          .select('slug'),
        // Auto-accept any pending invitations for this user's email
        supabase.rpc('accept_my_invitations'),
      ])

      const prof = profileRes.data as Profile | null
      if (prof && !prof.is_active) {
        // Deactivated account — force sign-out immediately
        await supabase.auth.signOut()
        return
      }

      setProfile(prof ?? null)
      setRoles((rolesRes.data ?? []).map((r: { slug: string }) => r.slug))
    } catch {
      // Profile may not exist yet (trigger propagation delay) — non-fatal
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        loadProfile(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        loadProfile(newSession.user.id)
      } else {
        setProfile(null)
        setRoles([])
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin          = roles.includes('admin')
  const isAccountManager = roles.includes('account_manager')
  const hasRole          = (slug: string) => roles.includes(slug)

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      roles,
      isAdmin,
      isAccountManager,
      hasRole,
      loading,
      signOut: doSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
