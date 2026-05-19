import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, MapPin, Wifi, Banknote, Clock, Calendar,
  Briefcase, Award, Loader2, Send, X as XIcon,
} from 'lucide-react'
import Section from '../../components/marketing/primitives/Section'
import SectionHeading from '../../components/marketing/primitives/SectionHeading'
import FadeIn from '../../components/marketing/primitives/FadeIn'
import PublicJobCard from '../../components/marketing/jobs/PublicJobCard'
import {
  getPublicJobBySlug, listRelatedPublicJobs,
  formatSalary, timeAgo, type PublicJob,
} from '../../lib/publicJobsService'

const REMOTE_LABELS: Record<string, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
}

const EMPLOYMENT_TYPE_JSONLD: Record<string, string> = {
  permanent: 'FULL_TIME',
  contract: 'CONTRACTOR',
  temporary: 'TEMPORARY',
  internship: 'INTERN',
  executive: 'FULL_TIME',
}

function DetailItem({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground font-medium">{value}</p>
      </div>
    </div>
  )
}

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
    </div>
  )
}

function buildJobPostingJsonLd(job: PublicJob): Record<string, unknown> {
  const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin

  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: (job.description ?? '').replace(/<[^>]*>/g, '').slice(0, 5000),
    datePosted: job.published_at,
    employmentType: job.employment_type
      ? EMPLOYMENT_TYPE_JSONLD[job.employment_type] ?? 'OTHER'
      : undefined,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'New Frontiers Talent',
      sameAs: siteUrl,
      parentOrganization: {
        '@type': 'Organization',
        name: 'New Frontiers Business Consultancy',
      },
    },
    directApply: true,
  }

  if (job.apply_deadline) obj.validThrough = job.apply_deadline

  if (job.remote_policy === 'remote') {
    obj.jobLocationType = 'TELECOMMUTE'
    if (job.location) {
      obj.applicantLocationRequirements = {
        '@type': 'Country',
        name: job.location,
      }
    }
  } else if (job.location) {
    obj.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location,
      },
    }
  }

  if (job.salary_min != null && job.salary_max != null && job.salary_currency) {
    obj.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.salary_currency,
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salary_min,
        maxValue: job.salary_max,
        unitText: 'YEAR',
      },
    }
  }

  // Strip undefined values
  return JSON.parse(JSON.stringify(obj))
}

export default function PublicJobDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [related, setRelated] = useState<PublicJob[]>([])
  const [relatedLoading, setRelatedLoading] = useState(true)

  // Sticky apply bar state
  const [ctaEl, setCtaEl] = useState<HTMLDivElement | null>(null)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const [barDismissed, setBarDismissed] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    setNotFound(false)
    setRelatedLoading(true)
    setBarDismissed(sessionStorage.getItem(`apply-bar-dismissed-${slug}`) === '1')

    getPublicJobBySlug(slug)
      .then(j => {
        if (!j) { setNotFound(true); return }
        setJob(j)
        return listRelatedPublicJobs(slug, j.employment_type, 3)
          .then(setRelated)
      })
      .catch(() => setNotFound(true))
      .finally(() => {
        setLoading(false)
        setRelatedLoading(false)
      })
  }, [slug])

  // IntersectionObserver for sticky bar (G7)
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]) setShowStickyBar(!entries[0].isIntersecting)
    },
    []
  )

  useEffect(() => {
    if (!ctaEl) return
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.5 })
    observer.observe(ctaEl)
    return () => observer.disconnect()
  }, [observerCallback, ctaEl])

  const dismissBar = () => {
    setBarDismissed(true)
    if (slug) sessionStorage.setItem(`apply-bar-dismissed-${slug}`, '1')
  }

  if (loading) {
    return (
      <Section className="py-32">
        <div className="flex justify-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      </Section>
    )
  }

  if (notFound || !job) {
    return (
      <>
        <Helmet>
          <title>Role not found | New Frontiers Talent</title>
        </Helmet>
        <Section className="py-32 text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-4">Role not found</h1>
          <p className="text-muted-foreground mb-6">
            This position may have been filled or removed.
          </p>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft size={14} />
            Back to all roles
          </Link>
        </Section>
      </>
    )
  }

  const salary = formatSalary(job)
  const posted = job.published_at ? timeAgo(job.published_at) : null
  const deadlineStr = job.apply_deadline
    ? new Date(job.apply_deadline).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null
  const jsonLd = buildJobPostingJsonLd(job)

  return (
    <>
      <Helmet>
        <title>{job.title} | New Frontiers Talent</title>
        <meta
          name="description"
          content={
            job.description
              ? job.description.replace(/<[^>]*>/g, '').slice(0, 155)
              : `${job.title} — apply now at New Frontiers Talent.`
          }
        />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Section className="pt-24 md:pt-32 pb-16">
        <FadeIn>
          {/* Back link */}
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft size={14} />
            All open roles
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                {job.employment_type && (
                  <span className="inline-block rounded-full bg-secondary/40 text-secondary-foreground px-2.5 py-1 text-xs font-medium uppercase tracking-wider mb-4">
                    {job.employment_type}
                  </span>
                )}
                <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                  {job.title}
                </h1>
                {posted && (
                  <p className="mt-2 text-sm text-muted-foreground inline-flex items-center gap-1">
                    <Clock size={14} />
                    Posted {posted}
                  </p>
                )}
              </div>

              {/* Description */}
              {job.description ? (
                <div className="prose prose-sm max-w-none text-foreground/90 [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_a]:text-primary">
                  {job.description.split('\n').map((line, i) => (
                    <p key={i} className={line.trim() === '' ? 'h-4' : ''}>
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Full details for this role are available upon inquiry. Contact us to learn more.
                </p>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              {/* Apply card */}
              <div className="border border-border rounded-xl bg-card p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Interested?</h2>
                <p className="text-sm text-muted-foreground">
                  Get in touch to learn more about this role or submit your application.
                </p>
                <div ref={setCtaEl}>
                  <Link
                    to={`/jobs/${job.slug}/apply`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Send size={14} />
                    Apply for this role
                  </Link>
                </div>
                {deadlineStr && (
                  <p className="text-xs text-muted-foreground text-center">
                    Applications close {deadlineStr}
                  </p>
                )}
              </div>

              {/* Details card */}
              <div className="border border-border rounded-xl bg-card p-6 space-y-5">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Role details</h3>
                {job.location && <DetailItem icon={MapPin} label="Location" value={job.location} />}
                {job.remote_policy && (
                  <DetailItem
                    icon={Wifi}
                    label="Work mode"
                    value={REMOTE_LABELS[job.remote_policy] ?? job.remote_policy}
                  />
                )}
                {job.employment_type && (
                  <DetailItem
                    icon={Briefcase}
                    label="Employment type"
                    value={job.employment_type.charAt(0).toUpperCase() + job.employment_type.slice(1)}
                  />
                )}
                {job.seniority && <DetailItem icon={Award} label="Seniority" value={job.seniority} />}
                {salary && <DetailItem icon={Banknote} label="Salary range" value={salary} />}
                {deadlineStr && <DetailItem icon={Calendar} label="Deadline" value={deadlineStr} />}
              </div>
            </aside>
          </div>
        </FadeIn>
      </Section>

      {/* Related roles (G6) */}
      {!relatedLoading && related.length > 0 && (
        <Section className="border-t border-border">
          <SectionHeading
            eyebrow="Other open roles"
            title="You might also like."
            align="left"
          />
          <FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.map(r => (
                <PublicJobCard key={r.id} job={r} />
              ))}
            </div>
          </FadeIn>
        </Section>
      )}
      {relatedLoading && (
        <Section className="border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
          </div>
        </Section>
      )}

      {/* Sticky bottom apply bar — lg+ only (G7) */}
      <AnimatePresence>
        {showStickyBar && !barDismissed && job && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-lg hidden lg:block"
          >
            <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{job.title}</p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {job.location && <span>{job.location}</span>}
                  {job.employment_type && (
                    <span>{job.employment_type.charAt(0).toUpperCase() + job.employment_type.slice(1)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={`/jobs/${job.slug}/apply`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Send size={14} />
                  Apply for this role
                </Link>
                <button
                  onClick={dismissBar}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Dismiss apply bar"
                >
                  <XIcon size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
