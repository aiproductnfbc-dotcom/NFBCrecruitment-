import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  CheckCircle2, MapPin, Briefcase, Wifi, Clock, Send, ArrowLeft, Loader2,
} from 'lucide-react'
import Eyebrow from '../../components/marketing/primitives/Eyebrow'
import { getPublicJobBySlug, type PublicJob } from '../../lib/publicJobsService'

const REMOTE_LABELS: Record<string, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
}

export default function JobApplyAppliedPage() {
  const { slug } = useParams<{ slug: string }>()
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) { setLoading(false); return }
    getPublicJobBySlug(slug)
      .then(j => setJob(j))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <>
      <Helmet>
        <title>Application received | New Frontiers Talent</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        {/* Success icon */}
        <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
          <CheckCircle2 size={32} className="text-primary" />
        </div>

        <Eyebrow>Application received</Eyebrow>

        <h1 className="mt-4 text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          Thanks — we've got it.
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          We'll be in touch within one business day.
        </p>

        {/* Role recap */}
        {loading ? (
          <div className="flex justify-center mt-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : job ? (
          <div className="mt-8 border border-border rounded-xl bg-card p-5 text-left">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              You applied for
            </p>
            <p className="text-lg font-semibold text-foreground">{job.title}</p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
              {job.location && (
                <span className="inline-flex items-center gap-1"><MapPin size={12} /> {job.location}</span>
              )}
              {job.employment_type && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase size={12} />
                  {job.employment_type.charAt(0).toUpperCase() + job.employment_type.slice(1)}
                </span>
              )}
              {job.remote_policy && (
                <span className="inline-flex items-center gap-1">
                  <Wifi size={12} />
                  {REMOTE_LABELS[job.remote_policy] ?? job.remote_policy}
                </span>
              )}
            </div>
          </div>
        ) : null}

        {/* CTAs */}
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            Browse other roles
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
          >
            Back to home
          </Link>
        </div>

        {/* What happens next */}
        <div className="mt-10 border border-border rounded-xl bg-card p-5 text-left">
          <p className="text-sm font-semibold text-foreground mb-3">What happens next?</p>
          <ol className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex gap-2.5">
              <span className="shrink-0 mt-0.5"><Clock size={14} className="text-primary" /></span>
              We read every application within 1 business day
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0 mt-0.5"><CheckCircle2 size={14} className="text-primary" /></span>
              A specialist reviews your fit for this role
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0 mt-0.5"><Send size={14} className="text-primary" /></span>
              We come back with next steps either way
            </li>
          </ol>
        </div>
      </div>
    </>
  )
}
