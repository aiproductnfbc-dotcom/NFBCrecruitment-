import { useEffect, useState } from 'react'
import { UserPlus, CheckCircle, AlertCircle, X } from 'lucide-react'
import FileDropZone from '../components/FileDropZone'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { getEmployees, createEmployee, type Employee } from '../lib/employeeManager'
import { processUpload, type UploadResult } from '../lib/uploadProcessor'

function ProgressBar({ processed, total }: { processed: number; total: number }) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-accent-foreground">
        <span>Importing new contacts…</span>
        <span className="font-semibold">{pct}% ({processed.toLocaleString()} / {total.toLocaleString()})</span>
      </div>
      <div className="w-full bg-accent rounded-full h-3 overflow-hidden">
        <div
          className="bg-primary h-3 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {total - processed > 0
          ? `${(total - processed).toLocaleString()} new contacts remaining — keep this tab open`
          : 'Finalising…'}
      </p>
    </div>
  )
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export default function UploadPage() {
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [empError, setEmpError]       = useState<string | null>(null)
  const [selectedId, setSelectedId]   = useState<string>('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName]         = useState('')
  const [newEmail, setNewEmail]       = useState('')
  const [savingEmp, setSavingEmp]     = useState(false)

  const [file, setFile]               = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [progress, setProgress]       = useState<{ processed: number; total: number } | null>(null)
  const [result, setResult]           = useState<UploadResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    getEmployees()
      .then(setEmployees)
      .catch((e: any) => setEmpError(e.message ?? String(e)))
  }, [])

  const handleAddEmployee = async () => {
    if (!newName.trim()) return
    setSavingEmp(true)
    try {
      const emp = await createEmployee(newName.trim(), newEmail.trim() || undefined)
      setEmployees(prev => [...prev, emp])
      setSelectedId(emp.id)
      setShowNewForm(false)
      setNewName('')
      setNewEmail('')
    } catch (e: any) {
      alert(`Failed to create employee: ${e.message}`)
    } finally {
      setSavingEmp(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedId || !file) return
    setUploading(true)
    setResult(null)
    setUploadError(null)
    setProgress(null)
    try {
      const content = await readFileAsText(file)
      const res = await processUpload(content, selectedId, file.name, (processed, total) => {
        setProgress({ processed, total })
      })
      setResult(res)
    } catch (e: any) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  const canUpload = !!selectedId && !!file && !uploading

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Upload LinkedIn Connections</h2>
        <p className="text-gray-500 text-sm mt-1">Import a LinkedIn CSV export to add contacts to the database</p>
      </div>

      {/* Section 1 — Employee Selection */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-700 mb-3">1. Select Employee</h3>
        {empError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            Failed to load employees: {empError}
          </div>
        )}
        <div className="flex items-center gap-3">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Choose an employee —</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}{emp.email ? ` (${emp.email})` : ''}</option>
            ))}
          </select>
          <button
            onClick={() => setShowNewForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <UserPlus size={15} />
            {showNewForm ? 'Cancel' : 'Add New'}
          </button>
        </div>

        {showNewForm && (
          <div className="mt-3 p-3 bg-muted rounded-lg border border-border flex flex-col gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Full name *"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Email (optional)"
              type="email"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={handleAddEmployee}
              disabled={!newName.trim() || savingEmp}
              className="self-start px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {savingEmp ? 'Saving…' : 'Save Employee'}
            </button>
          </div>
        )}
      </div>

      {/* Section 2 — CSV Upload */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-700 mb-3">2. Choose CSV File</h3>
        <FileDropZone onFile={setFile} selectedFile={file} />
        {file && (
          <button
            onClick={() => setFile(null)}
            className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
          >
            <X size={12} /> Remove file
          </button>
        )}
      </div>

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!canUpload}
        className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? 'Processing…' : 'Upload & Process'}
      </button>

      {/* Section 3 — Processing status */}
      {uploading && (
        <div className="bg-accent border border-border rounded-lg p-4">
          {progress ? (
            <ProgressBar processed={progress.processed} total={progress.total} />
          ) : (
            <p className="text-accent-foreground text-sm animate-pulse">Parsing CSV and deduplicating…</p>
          )}
        </div>
      )}

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{uploadError}</p>
        </div>
      )}

      {result && (
        <>
          {/* Summary card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" />
                <h3 className="font-semibold text-gray-800">Upload Complete</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {result.durationMs < 1000
                  ? `${result.durationMs}ms`
                  : `${(result.durationMs / 1000).toFixed(1)}s`}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-bold text-foreground">{result.totalRows.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Rows</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-700">{result.newContacts.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">Imported</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-700">{result.duplicates.toLocaleString()}</p>
                <p className="text-xs text-yellow-600 mt-1">Skipped (dups)</p>
              </div>
              <div className="bg-accent rounded-lg p-3">
                <p className="text-2xl font-bold text-accent-foreground">{result.errors.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Errors</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 bg-red-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-600 mb-1">{result.errors.length} error(s):</p>
                {result.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-red-500">{e}</p>
                ))}
              </div>
            )}
          </div>

          {/* Section 4 — New contacts preview */}
          {result.newContactsList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-3">
                New Contacts Added
                {result.newContactsList.length > 50 && (
                  <span className="text-gray-400 font-normal text-sm ml-2">
                    (showing 50 of {result.newContactsList.length})
                  </span>
                )}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="pb-2 pr-3">Name</th>
                      <th className="pb-2 pr-3">Company</th>
                      <th className="pb-2 pr-3">Raw Position</th>
                      <th className="pb-2 pr-3">Normalized</th>
                      <th className="pb-2 pr-3">Seniority</th>
                      <th className="pb-2">Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.newContactsList.slice(0, 50).map((c, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3 font-medium text-gray-800 whitespace-nowrap">{c.name}</td>
                        <td className="py-2 pr-3 text-gray-500 truncate max-w-[120px]">{c.company ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-400 truncate max-w-[140px]">{c.position ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-700 truncate max-w-[140px]">{c.normalized_title || '—'}</td>
                        <td className="py-2 pr-3"><Badge value={c.seniority} variant="seniority" /></td>
                        <td className="py-2"><Badge value={c.department} variant="department" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.newContactsList.length > 50 && (
                  <p className="text-sm text-gray-400 mt-2 text-center">
                    …and {result.newContactsList.length - 50} more
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
