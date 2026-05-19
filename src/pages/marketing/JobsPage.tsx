import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Search, X, Loader2, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import PageHero from '../../components/marketing/primitives/PageHero'
import Section from '../../components/marketing/primitives/Section'
import FadeIn from '../../components/marketing/primitives/FadeIn'
import PublicJobCard from '../../components/marketing/jobs/PublicJobCard'
import { listPublicJobs, type PublicJob, type ListPublicJobsParams } from '../../lib/publicJobsService'
import { JOB_BOARD } from '../../content/marketing/jobBoard'

const PAGE_SIZE = 12

// ── URL-state helpers ──────────────────────────────────────────────────────

function useParam(key: string): [string, (v: string | undefined) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const value = searchParams.get(key) ?? ''
  const set = useCallback(
    (v: string | undefined) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          if (!v) next.delete(key)
          else next.set(key, v)
          // Reset page on filter change (not sort)
          if (key !== 'sort' && key !== 'page') next.delete('page')
          return next
        },
        { replace: true }
      )
    },
    [key, setSearchParams]
  )
  return [value, set]
}

function useParamDebounced(
  key: string,
  delay = 250
): [string, string, (v: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlValue = searchParams.get(key) ?? ''
  const [local, setLocal] = useState(urlValue)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Sync local when URL changes externally (e.g. clear all)
  useEffect(() => { setLocal(urlValue) }, [urlValue])

  const set = useCallback(
    (v: string) => {
      setLocal(v)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setSearchParams(
          prev => {
            const next = new URLSearchParams(prev)
            if (!v) next.delete(key)
            else next.set(key, v)
            next.delete('page')
            return next
          },
          { replace: true }
        )
      }, delay)
    },
    [key, delay, setSearchParams]
  )

  return [urlValue, local, set]
}

// ── Document title ─────────────────────────────────────────────────────────

function computeDocumentTitle(params: {
  q: string; type: string; remote: string; seniority: string
}): string {
  const parts: string[] = []
  if (params.remote === 'remote') parts.push('Remote')
  if (params.seniority) parts.push(params.seniority)
  if (params.type) {
    const label = JOB_BOARD.filters.employmentType.find(o => o.value === params.type)?.label
    parts.push(label?.toLowerCase() ?? params.type)
  }
  if (parts.length > 0) {
    return parts.join(' ') + ' roles'
  }
  if (params.q) return `Roles matching '${params.q}'`
  return 'Open Roles'
}

// ── Filter chip helpers ────────────────────────────────────────────────────

interface Chip { key: string; label: string }

function buildChips(params: {
  q: string; type: string; remote: string; seniority: string; location: string
}): Chip[] {
  const chips: Chip[] = []
  if (params.q) chips.push({ key: 'q', label: `Search: "${params.q}"` })
  if (params.type) {
    const label = JOB_BOARD.filters.employmentType.find(o => o.value === params.type)?.label ?? params.type
    chips.push({ key: 'type', label })
  }
  if (params.remote) {
    const label = JOB_BOARD.filters.remotePolicy.find(o => o.value === params.remote)?.label ?? params.remote
    chips.push({ key: 'remote', label })
  }
  if (params.seniority) chips.push({ key: 'seniority', label: params.seniority })
  if (params.location) chips.push({ key: 'location', label: `in ${params.location}` })
  return chips
}

// ── Skeleton card ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card animate-pulse h-[180px] p-6 space-y-4">
      <div className="flex justify-between">
        <div className="h-6 w-20 rounded-full bg-muted" />
        <div className="h-4 w-14 rounded bg-muted" />
      </div>
      <div className="h-5 w-3/4 rounded bg-muted" />
      <div className="flex gap-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-4 w-16 rounded bg-muted" />
      </div>
      <div className="h-4 w-20 rounded bg-muted mt-auto" />
    </div>
  )
}

// ── Select wrapper ─────────────────────────────────────────────────────────

const selectCls =
  'w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring'

// ── Main component ─────────────────────────────────────────────────────────

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-driven state
  const [qUrl, qLocal, setQ] = useParamDebounced('q', 250)
  const [typeVal, setType] = useParam('type')
  const [remoteVal, setRemote] = useParam('remote')
  const [seniorityVal, setSeniority] = useParam('seniority')
  const [locationUrl, locationLocal, setLocation] = useParamDebounced('location', 250)
  const sortVal = (searchParams.get('sort') as 'newest' | 'closing_soon') || 'newest'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  // Data
  const [jobs, setJobs] = useState<PublicJob[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Mobile filter toggle
  const [showFilters, setShowFilters] = useState(false)

  const toolbarRef = useRef<HTMLDivElement>(null)

  const setSort = useCallback(
    (v: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          if (v === 'newest') next.delete('sort')
          else next.set('sort', v)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setPage = useCallback(
    (p: number) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          if (p <= 1) next.delete('page')
          else next.set('page', String(p))
          return next
        },
        { replace: true }
      )
      toolbarRef.current?.scrollIntoView({ behavior: 'smooth' })
    },
    [setSearchParams]
  )

  // Fetch on any URL param change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    const params: ListPublicJobsParams = {
      keyword: qUrl || undefined,
      employment_type: typeVal || undefined,
      remote_policy: (remoteVal as ListPublicJobsParams['remote_policy']) || undefined,
      seniority: seniorityVal || undefined,
      location: locationUrl || undefined,
      sort: sortVal,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }

    listPublicJobs(params)
      .then(result => {
        if (cancelled) return
        setJobs(result.jobs)
        setTotal(result.total)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [qUrl, typeVal, remoteVal, seniorityVal, locationUrl, sortVal, page])

  const hasFilters = !!(qUrl || typeVal || remoteVal || seniorityVal || locationUrl)
  const chips = buildChips({
    q: qUrl, type: typeVal, remote: remoteVal,
    seniority: seniorityVal, location: locationUrl,
  })
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const showingStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showingEnd = Math.min(page * PAGE_SIZE, total)

  const activeFilterCount = chips.length

  const clearAll = () => {
    setSearchParams({}, { replace: true })
  }

  const removeChip = (key: string) => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true }
    )
  }

  const docTitle = computeDocumentTitle({
    q: qUrl, type: typeVal, remote: remoteVal, seniority: seniorityVal,
  })

  // ── Filter panel (shared between desktop sidebar and mobile collapsible) ──

  const filterPanel = (
    <div className="space-y-5">
      {/* Search */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Search</p>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Title, location, seniority…"
            value={qLocal}
            onChange={e => setQ(e.target.value)}
            className={`${selectCls} pl-9`}
          />
        </div>
      </div>

      {/* Type */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Type</p>
        <select value={typeVal} onChange={e => setType(e.target.value || undefined)} className={selectCls}>
          {JOB_BOARD.filters.employmentType.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Where */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Where</p>
        <div className="space-y-2">
          <select value={remoteVal} onChange={e => setRemote(e.target.value || undefined)} className={selectCls}>
            {JOB_BOARD.filters.remotePolicy.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="City or country"
            value={locationLocal}
            onChange={e => setLocation(e.target.value)}
            className={selectCls}
          />
        </div>
      </div>

      {/* Level */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Level</p>
        <select value={seniorityVal} onChange={e => setSeniority(e.target.value || undefined)} className={selectCls}>
          {JOB_BOARD.filters.seniority.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )

  return (
    <>
      <Helmet>
        <title>{docTitle} | New Frontiers Talent</title>
        <meta
          name="description"
          content="Browse open positions across the Middle East. New Frontiers Talent connects top talent with leading employers."
        />
      </Helmet>

      <PageHero
        eyebrow="Opportunities"
        title="Find your next role."
        subhead="Browse our current openings across the Middle East. New roles are added regularly — check back often or get in touch."
        primaryCta={{ label: 'Contact us', href: '/contact' }}
      />

      <Section>
        {/* Mobile filter toggle */}
        <div className="lg:hidden mb-6">
          <button
            onClick={() => setShowFilters(f => !f)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <SlidersHorizontal size={14} />
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ''}
          </button>
          {showFilters && (
            <FadeIn>
              <div className="mt-4 p-4 border border-border rounded-lg bg-muted/20">
                {filterPanel}
              </div>
            </FadeIn>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Desktop filter sidebar */}
          <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-24 self-start">
            {filterPanel}
          </aside>

          {/* Results */}
          <div className="lg:col-span-9">
            {/* Active filter chips (G5) */}
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {chips.map(chip => (
                  <span
                    key={chip.key}
                    className="rounded-full px-3 py-1 text-xs bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5"
                  >
                    {chip.label}
                    <button
                      onClick={() => removeChip(chip.key)}
                      className="hover:text-primary/70 transition-colors"
                      aria-label={`Remove ${chip.label} filter`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Toolbar */}
            <div ref={toolbarRef} className="flex items-center justify-between gap-4 mb-6">
              <p className="text-sm text-muted-foreground tabular-nums">
                {loading
                  ? '\u00A0'
                  : total === 0
                    ? '0 roles'
                    : `${showingStart}–${showingEnd} of ${total} roles`}
              </p>
              <select
                value={sortVal}
                onChange={e => setSort(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring w-auto"
              >
                {JOB_BOARD.filters.sort.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="text-center py-20">
                <p className="text-sm text-muted-foreground mb-3">
                  Couldn't load roles right now. Please try again.
                </p>
                <button
                  onClick={() => setSearchParams(prev => new URLSearchParams(prev), { replace: true })}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && total === 0 && (
              <div className="text-center py-20">
                {hasFilters ? (
                  <div>
                    <p className="text-muted-foreground mb-2">{JOB_BOARD.emptyState.heading}</p>
                    <p className="text-sm text-muted-foreground mb-4">{JOB_BOARD.emptyState.body}</p>
                    <Link
                      to={JOB_BOARD.emptyState.ctaHref}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {JOB_BOARD.emptyState.ctaLabel}
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No roles published yet — check back soon.
                  </p>
                )}
              </div>
            )}

            {/* Results grid */}
            {!loading && !error && total > 0 && (
              <FadeIn>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobs.map(job => (
                    <PublicJobCard key={job.id} job={job} />
                  ))}
                </div>
              </FadeIn>
            )}

            {/* Pagination (G4) */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </Section>
    </>
  )
}
