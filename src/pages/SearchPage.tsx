import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ExternalLink, Download, UserPlus, ChevronDown, ChevronUp } from 'lucide-react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { SkeletonTable } from '../components/LoadingSkeleton'
import TagInput from '../components/TagInput'
import { useToast } from '../components/Toast'
import { searchCandidates, type CandidateMatch } from '../lib/searchService'
import { addToShortlist } from '../lib/shortlistService'
import { exportSearchResultsToCSV, downloadCSV } from '../lib/exportService'
import { getJobs, type Job } from '../lib/jobService'

// ─── Constants ────────────────────────────────────────────────────────────────

const SENIORITY_LEVELS = ['Intern','Junior','Mid','Senior','Lead','Manager','Director','VP','C-Suite']
const DEPARTMENTS = [
  'Architecture','Consulting','Data','Design','Education','Energy',
  'Engineering','Executive','Finance','Healthcare','Hospitality',
  'HR','Legal','Marketing','Operations','Product','Real Estate','Sales','Other',
]

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 30 ? 'bg-green-100 text-green-800' :
    score >= 15 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score.toFixed(1)}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  // Pre-fill from URL params (when navigating from RequestsPage)
  const urlTitle      = searchParams.get('title')     ?? ''
  const urlDept       = searchParams.get('dept')      ?? ''
  const urlSeniority  = searchParams.get('seniority') ?? ''
  const urlRequestId  = searchParams.get('request')   ?? ''

  const [jobTitle, setJobTitle]     = useState(urlTitle)
  const [department, setDepartment] = useState(urlDept)
  const [seniority, setSeniority]   = useState(urlSeniority)
  const [keywords, setKeywords]     = useState<string[]>([])

  const [results, setResults]       = useState<CandidateMatch[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading]       = useState(false)

  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())

  const [requests, setRequests]     = useState<Job[]>([])
  const [targetRequest, setTargetRequest] = useState(urlRequestId)
  const [addingToShortlist, setAddingToShortlist] = useState(false)

  // Load open requests for shortlist picker
  useEffect(() => {
    getJobs('open').then(setRequests).catch(console.error)
  }, [])

  // Auto-search if pre-filled from URL
  useEffect(() => {
    if (urlTitle) {
      handleSearch(urlTitle, urlDept, urlSeniority, [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = useCallback(async (
    title = jobTitle,
    dept  = department,
    sen   = seniority,
    kw    = keywords,
  ) => {
    if (!title.trim()) return
    setLoading(true)
    setHasSearched(true)
    setSelected(new Set())
    try {
      const data = await searchCandidates({
        job_title:  title.trim(),
        department: dept  || undefined,
        seniority:  sen   || undefined,
        keywords:   kw.length ? kw : undefined,
      })
      setResults(data)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [jobTitle, department, seniority, keywords, toast])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(results.map(r => r.contact_id)))
    }
  }

  const handleAddToShortlist = async () => {
    if (!targetRequest || !selected.size) return
    setAddingToShortlist(true)
    try {
      const candidates = results
        .filter(r => selected.has(r.contact_id))
        .map(r => ({ contact_id: r.contact_id, match_score: r.match_score }))
      await addToShortlist(targetRequest, candidates)
      toast(`${candidates.length} candidate${candidates.length > 1 ? 's' : ''} added to shortlist`, 'success')
      setSelected(new Set())
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setAddingToShortlist(false)
    }
  }

  const handleExport = () => {
    if (!results.length) return
    const csv = exportSearchResultsToCSV(results)
    downloadCSV(csv, `search-results-${jobTitle.replace(/\s+/g, '-')}.csv`)
    toast('Results exported', 'success')
  }

  const handleViewRequest = () => {
    if (targetRequest) navigate(`/app/jobs?expand=${targetRequest}`)
  }

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Search & Match</h2>
        <p className="text-gray-500 text-sm mt-1">Find candidates from the contacts database</p>
      </div>

      {/* Search form */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Job Title *</label>
            <input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. Software Engineer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Department</label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Any</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Seniority</label>
            <select
              value={seniority}
              onChange={e => setSeniority(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Any</option>
              {SENIORITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Keywords</label>
          <TagInput value={keywords} onChange={setKeywords} placeholder="Add keywords, press Enter" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSearch()}
            disabled={!jobTitle.trim() || loading}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Search size={15} />
            {loading ? 'Searching…' : 'Search'}
          </button>
          {hasSearched && !loading && (
            <span className="text-sm text-gray-500">
              {results.length} candidate{results.length !== 1 ? 's' : ''} found
            </span>
          )}
        </div>
      </div>

      {/* Results toolbar */}
      {hasSearched && !loading && results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === results.length && results.length > 0}
              onChange={handleSelectAll}
              className="rounded"
            />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>

          {selected.size > 0 && (
            <>
              <div className="flex items-center gap-2">
                <select
                  value={targetRequest}
                  onChange={e => setTargetRequest(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Pick a request —</option>
                  {requests.map(r => (
                    <option key={r.id} value={r.id}>{r.job_title}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddToShortlist}
                  disabled={!targetRequest || addingToShortlist}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <UserPlus size={14} />
                  {addingToShortlist ? 'Adding…' : 'Add to Shortlist'}
                </button>
                {targetRequest && (
                  <button
                    onClick={handleViewRequest}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View Request
                  </button>
                )}
              </div>
            </>
          )}

          <div className="ml-auto">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Results table */}
      {hasSearched && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium w-8"></th>
                  <th className="px-4 py-3 font-medium w-8"></th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Seniority</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Sources</th>
                  <th className="px-4 py-3 font-medium">LinkedIn</th>
                </tr>
              </thead>
              {loading ? (
                <SkeletonTable rows={10} />
              ) : results.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={10}>
                      <EmptyState title="No candidates found" description="Try adjusting the job title, department, or seniority" />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {results.map(candidate => {
                    const isSelected = selected.has(candidate.contact_id)
                    const isExpanded = expanded.has(candidate.contact_id)
                    return (
                      <>
                        <tr
                          key={candidate.contact_id}
                          className={`border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(candidate.contact_id)}
                              className="rounded"
                            />
                          </td>
                          <td
                            className="px-4 py-3 text-gray-400 cursor-pointer"
                            onClick={() => toggleExpand(candidate.contact_id)}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                            {candidate.first_name} {candidate.last_name}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">
                            {candidate.company ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                            {candidate.normalized_title ?? candidate.position_raw ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge value={candidate.seniority_level} variant="seniority" />
                          </td>
                          <td className="px-4 py-3">
                            <Badge value={candidate.department} variant="department" />
                          </td>
                          <td className="px-4 py-3">
                            <ScoreBadge score={candidate.match_score} />
                          </td>
                          <td className="px-4 py-3">
                            {candidate.source_employees.length > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                                {candidate.source_employees.length} employee{candidate.source_employees.length > 1 ? 's' : ''}
                              </span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {candidate.linkedin_url ? (
                              <a
                                href={candidate.linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <ExternalLink size={14} />
                              </a>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>

                        {/* Expanded row */}
                        {isExpanded && (
                          <tr key={`${candidate.contact_id}-expanded`} className="bg-muted border-b border-slate-100">
                            <td colSpan={10} className="px-10 py-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                                  <p className="text-gray-700">{candidate.email ?? '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Raw Position</p>
                                  <p className="text-gray-700">{candidate.position_raw ?? '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Match Score</p>
                                  <p className="text-gray-700 font-semibold">{candidate.match_score.toFixed(2)}</p>
                                </div>
                                {candidate.source_employees.length > 0 && (
                                  <div className="col-span-full">
                                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Source Employees</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {candidate.source_employees.map(name => (
                                        <span key={name} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">
                                          {name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Empty prompt before first search */}
      {!hasSearched && !loading && (
        <div className="bg-white border border-gray-200 rounded-lg py-16 flex flex-col items-center gap-3">
          <div className="bg-blue-50 rounded-full p-4">
            <Search size={28} className="text-blue-400" />
          </div>
          <p className="text-gray-500 text-sm">Enter a job title above and click Search to find matching candidates</p>
        </div>
      )}
    </div>
  )
}
