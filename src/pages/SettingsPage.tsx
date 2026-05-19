import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Trash2, Plus, Play, RefreshCw, Pencil, X, Check, Eye, EyeOff, Loader2, User, Mail, AlertCircle, CheckCircle2, Clock, Ban } from 'lucide-react'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { getEmployees, createEmployee, type Employee } from '../lib/employeeManager'
import { categorizeTitleWithRules, type TitleMappingRule, type CategorizedResult } from '../lib/categorize'
import { bulkRecategorize, type RecategorizeResult } from '../lib/bulkRecategorize'
import { getEmailLog, type EmailLogEntry, type EmailLogStatus } from '../lib/emailService'
import { supabase } from '../lib/supabaseClient'

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'employees' | 'rules' | 'recategorize' | 'email-log'

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, profile } = useAuth()
  const { toast } = useToast()

  const [name,        setName]        = useState(profile?.full_name ?? '')
  const [savingName,  setSavingName]  = useState(false)

  const [currentPwd,  setCurrentPwd]  = useState('')
  const [newPwd,      setNewPwd]      = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [savingPwd,   setSavingPwd]   = useState(false)
  const [pwdErr,      setPwdErr]      = useState('')

  // Keep name in sync if profile loads after mount
  useEffect(() => { setName(profile?.full_name ?? '') }, [profile])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSavingName(true)
    try {
      const { error: authErr } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
      if (authErr) throw new Error(authErr.message)
      const { error: dbErr } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user!.id)
      if (dbErr) throw new Error(dbErr.message)
      toast('Name updated', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSavingName(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdErr('')
    if (newPwd !== confirmPwd) { setPwdErr('Passwords do not match'); return }
    if (newPwd.length < 8)     { setPwdErr('Password must be at least 8 characters'); return }
    setSavingPwd(true)
    try {
      // Re-authenticate with current password first
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    profile?.email ?? user?.email ?? '',
        password: currentPwd,
      })
      if (signInErr) { setPwdErr('Current password is incorrect'); return }

      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw new Error(error.message)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      toast('Password changed', 'success')
    } catch (e: any) {
      setPwdErr(e.message)
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="space-y-8 max-w-md">

      {/* ── Display name ─────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User size={15} className="text-gray-400" /> Profile
        </h3>
        <form onSubmit={handleSaveName} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              value={profile?.email ?? user?.email ?? ''}
              disabled
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Display name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={savingName || !name.trim() || name.trim() === profile?.full_name}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {savingName && <Loader2 size={13} className="animate-spin" />}
            {savingName ? 'Saving…' : 'Save name'}
          </button>
        </form>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Change password ───────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Change password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current password</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              placeholder="Enter current password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {pwdErr && (
            <p className="text-xs text-red-600">{pwdErr}</p>
          )}
          <button
            type="submit"
            disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {savingPwd && <Loader2 size={13} className="animate-spin" />}
            {savingPwd ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

function EmployeesTab() {
  const { toast } = useToast()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setEmployees(await getEmployees())
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const emp = await createEmployee(name.trim(), email.trim() || undefined)
      setEmployees(prev => [...prev, emp])
      setName('')
      setEmail('')
      setShowForm(false)
      toast('Employee added', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const { error } = await supabase.from('employees').delete().eq('id', deleteTarget.id)
      if (error) throw new Error(error.message)
      setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id))
      toast('Employee removed', 'info')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{employees.length} employee{employees.length !== 1 ? 's' : ''} in the database</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <UserPlus size={14} /> {showForm ? 'Cancel' : 'Add Employee'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-muted border border-border rounded-lg p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-4 text-center">Loading…</div>
      ) : employees.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">No employees added yet</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDeleteTarget(emp)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Employee"
        message={`Remove "${deleteTarget?.name}"? Their contact uploads will remain but will no longer show this employee as a source.`}
        confirmText="Remove"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────

const SENIORITY_LEVELS = ['Intern','Junior','Mid','Senior','Lead','Manager','Director','VP','C-Suite']
const DEPARTMENTS = [
  'Architecture','Consulting','Data','Design','Education','Energy',
  'Engineering','Executive','Finance','Healthcare','Hospitality',
  'HR','Legal','Marketing','Operations','Product','Real Estate','Sales','Other',
]

interface RuleRow extends TitleMappingRule {
  id: string
}

function RulesTab() {
  const { toast } = useToast()
  const [rules, setRules]         = useState<RuleRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RuleRow | null>(null)
  const [editId, setEditId]       = useState<string | null>(null)

  // Form state
  const [pattern, setPattern]           = useState('')
  const [normalized, setNormalized]     = useState('')
  const [seniority, setSeniority]       = useState('')
  const [dept, setDept]                 = useState('')
  const [priority, setPriority]         = useState(0)

  // Test input
  const [testInput, setTestInput]       = useState('')
  const [testResult, setTestResult]     = useState<CategorizedResult & { matched: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('title_mapping_rules')
        .select()
        .order('priority', { ascending: false })
      if (error) throw new Error(error.message)
      setRules((data ?? []) as RuleRow[])
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setPattern(''); setNormalized(''); setSeniority(''); setDept(''); setPriority(0)
    setShowForm(false); setEditId(null)
  }

  const startEdit = (rule: RuleRow) => {
    setPattern(rule.pattern)
    setNormalized(rule.normalized_title ?? '')
    setSeniority(rule.seniority_level ?? '')
    setDept(rule.department ?? '')
    setPriority(rule.priority)
    setEditId(rule.id)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pattern.trim() || !normalized.trim()) return
    setSaving(true)
    try {
      const payload = {
        pattern:          pattern.trim(),
        normalized_title: normalized.trim(),
        seniority_level:  seniority || null,
        department:       dept     || null,
        priority,
      }

      if (editId) {
        const { data, error } = await supabase
          .from('title_mapping_rules')
          .update(payload)
          .eq('id', editId)
          .select()
          .single()
        if (error) throw new Error(error.message)
        setRules(prev => prev.map(r => r.id === editId ? data as RuleRow : r))
        toast('Rule updated', 'success')
      } else {
        const { data, error } = await supabase
          .from('title_mapping_rules')
          .insert(payload)
          .select()
          .single()
        if (error) throw new Error(error.message)
        setRules(prev => [data as RuleRow, ...prev])
        toast('Rule created', 'success')
      }
      resetForm()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const { error } = await supabase.from('title_mapping_rules').delete().eq('id', deleteTarget.id)
      if (error) throw new Error(error.message)
      setRules(prev => prev.filter(r => r.id !== deleteTarget.id))
      toast('Rule deleted', 'info')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleTest = () => {
    if (!testInput.trim()) return
    const result = categorizeTitleWithRules(testInput.trim(), rules)
    const matched = rules.some(r => {
      try { return new RegExp(r.pattern, 'i').test(testInput.trim()) } catch { return false }
    })
    setTestResult({ ...result, matched })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rules.length} custom rule{rules.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { resetForm(); setShowForm(v => !v) }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> {showForm && !editId ? 'Cancel' : 'New Rule'}
        </button>
      </div>

      {/* Test area */}
      <div className="bg-muted border border-border rounded-lg p-4">
        <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Test Categorization</p>
        <div className="flex gap-2">
          <input
            value={testInput}
            onChange={e => setTestInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()}
            placeholder="e.g. Principal Machine Learning Engineer"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleTest}
            disabled={!testInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 disabled:opacity-50 transition-colors"
          >
            <Play size={13} /> Test
          </button>
        </div>
        {testResult && (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <div>
              <span className="text-xs text-gray-400">Normalized: </span>
              <span className="font-medium text-gray-800">{testResult.normalized_title || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400">Seniority: </span>
              <Badge value={testResult.seniority_level} variant="seniority" />
            </div>
            <div>
              <span className="text-xs text-gray-400">Department: </span>
              <Badge value={testResult.department} variant="department" />
            </div>
            <div>
              <span className="text-xs text-gray-400">Custom rule matched: </span>
              <span className={`font-medium ${testResult.matched ? 'text-green-600' : 'text-gray-500'}`}>
                {testResult.matched ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Rule form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">{editId ? 'Edit Rule' : 'New Mapping Rule'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Regex Pattern *</label>
              <input
                value={pattern}
                onChange={e => setPattern(e.target.value)}
                placeholder="e.g. \\bML\\s+Engineer\\b"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Normalized Title *</label>
              <input
                value={normalized}
                onChange={e => setNormalized(e.target.value)}
                placeholder="e.g. Machine Learning Engineer"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Seniority</label>
              <select
                value={seniority}
                onChange={e => setSeniority(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Auto-detect</option>
                {SENIORITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select
                value={dept}
                onChange={e => setDept(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Auto-detect</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority (higher = first)</label>
              <input
                type="number"
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !pattern.trim() || !normalized.trim()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Rule'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Rules table */}
      {loading ? (
        <div className="text-sm text-gray-400 py-4 text-center">Loading…</div>
      ) : rules.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">No custom rules yet. Create one above to override auto-categorization.</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Pattern</th>
                <th className="px-4 py-3 font-medium">Normalized Title</th>
                <th className="px-4 py-3 font-medium">Seniority</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-[200px] truncate">
                    {rule.pattern}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{rule.normalized_title}</td>
                  <td className="px-4 py-3">
                    <Badge value={rule.seniority_level} variant="seniority" />
                  </td>
                  <td className="px-4 py-3">
                    <Badge value={rule.department} variant="department" />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{rule.priority}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(rule)}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(rule)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Rule"
        message={`Delete the rule for pattern "${deleteTarget?.pattern}"?`}
        confirmText="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ─── Recategorize Tab ─────────────────────────────────────────────────────────

function RecategorizeTab() {
  const { toast } = useToast()
  const [running, setRunning]   = useState(false)
  const [result, setResult]     = useState<RecategorizeResult | null>(null)
  const [confirm, setConfirm]   = useState(false)

  const run = async () => {
    setConfirm(false)
    setRunning(true)
    setResult(null)
    try {
      const res = await bulkRecategorize()
      setResult(res)
      toast(`Done — ${res.updated} contacts updated`, 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">What this does</p>
        <p>Re-runs the categorization engine on every contact in the database, applying your current custom rules. Contacts with manual overrides are skipped.</p>
      </div>

      <button
        onClick={() => setConfirm(true)}
        disabled={running}
        className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/90 disabled:opacity-50 transition-colors"
      >
        <RefreshCw size={15} className={running ? 'animate-spin' : ''} />
        {running ? 'Running…' : 'Run Bulk Recategorize'}
      </button>

      {running && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700 animate-pulse">
          Processing contacts in batches of 100… this may take a moment.
        </div>
      )}

      {result && !running && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Check size={18} className="text-green-500" />
            <h3 className="font-semibold text-gray-800">Recategorization Complete</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-800">{result.total}</p>
              <p className="text-xs text-gray-500 mt-1">Total Contacts</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-700">{result.updated}</p>
              <p className="text-xs text-green-600 mt-1">Updated</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-700">{result.errors}</p>
              <p className="text-xs text-red-600 mt-1">Errors</p>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Run Bulk Recategorize?"
        message="This will update categorization for all contacts not marked as manual override. The operation can take several minutes for large databases."
        confirmText="Run Now"
        onConfirm={run}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}

// ─── Email Log Tab ────────────────────────────────────────────────────────────

const STATUS_ICON: Record<EmailLogStatus, React.ReactNode> = {
  sent:    <CheckCircle2 size={13} className="text-green-500" />,
  queued:  <Clock        size={13} className="text-yellow-500" />,
  failed:  <AlertCircle  size={13} className="text-red-500" />,
  bounced: <Ban          size={13} className="text-orange-500" />,
}

const STATUS_LABEL: Record<EmailLogStatus, string> = {
  sent:    'bg-green-100 text-green-700',
  queued:  'bg-yellow-100 text-yellow-700',
  failed:  'bg-red-100 text-red-700',
  bounced: 'bg-orange-100 text-orange-700',
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function EmailLogTab() {
  const { toast }   = useToast()
  const [entries,   setEntries]   = useState<EmailLogEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<EmailLogStatus | ''>('')
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getEmailLog(filter ? { status: filter as EmailLogStatus } : {}, 200)
      setEntries(data)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useEffect(() => { load() }, [load])

  const STATUS_FILTERS: Array<EmailLogStatus | ''> = ['', 'sent', 'queued', 'failed', 'bounced']

  return (
    <div className="space-y-4">
      {/* Filter + refresh */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
          <Mail size={28} />
          <p className="text-sm font-medium">No emails yet</p>
          <p className="text-xs">Emails will appear here once they are sent by the system</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Sent by</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABEL[entry.status]}`}>
                        {STATUS_ICON[entry.status]}
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{entry.to_email}</td>
                    <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate">{entry.subject}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {(entry.template as any)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {(entry.sender as any)?.full_name ?? (entry.sender as any)?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {fmtDateTime(entry.created_at)}
                    </td>
                  </tr>
                  {expanded === entry.id && (
                    <tr key={`${entry.id}-detail`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={6} className="px-4 py-3 space-y-2">
                        {entry.error_message && (
                          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                            <AlertCircle size={12} className="mt-0.5 shrink-0" />
                            <span className="font-mono">{entry.error_message}</span>
                          </div>
                        )}
                        {entry.cc  && <p className="text-xs text-gray-500"><span className="font-medium">CC:</span> {entry.cc}</p>}
                        {entry.bcc && <p className="text-xs text-gray-500"><span className="font-medium">BCC:</span> {entry.bcc}</p>}
                        {entry.related_entity_type && (
                          <p className="text-xs text-gray-400">
                            Related: {entry.related_entity_type} {entry.related_entity_id}
                          </p>
                        )}
                        <details className="text-xs text-gray-500">
                          <summary className="cursor-pointer hover:text-gray-700 select-none">Show body</summary>
                          <pre className="mt-2 p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 whitespace-pre-wrap font-mono overflow-auto max-h-48">
                            {entry.body}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <p className="text-xs text-gray-400 text-right">Showing {entries.length} most recent emails</p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: 'profile',      label: 'Profile' },
    { id: 'employees',    label: 'Employees' },
    { id: 'rules',        label: 'Mapping Rules' },
    { id: 'recategorize', label: 'Bulk Recategorize' },
    { id: 'email-log',    label: 'Email Log', adminOnly: true },
  ]

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin)

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 text-sm mt-1">Manage employees, categorization rules, and database operations</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm rounded-md transition-colors font-medium ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        {tab === 'profile'      && <ProfileTab />}
        {tab === 'employees'    && <EmployeesTab />}
        {tab === 'rules'        && <RulesTab />}
        {tab === 'recategorize' && <RecategorizeTab />}
        {tab === 'email-log'    && <EmailLogTab />}
      </div>
    </div>
  )
}
