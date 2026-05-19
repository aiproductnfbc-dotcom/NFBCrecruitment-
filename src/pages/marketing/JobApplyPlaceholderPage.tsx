// PLACEHOLDER — Replaced by full apply form in Batch 10.

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Section from '../../components/marketing/primitives/Section'
import Eyebrow from '../../components/marketing/primitives/Eyebrow'
import { getPublicJobBySlug, type PublicJob } from '../../lib/publicJobsService'
import { SITE } from '../../content/marketing/site'

export default function JobApplyPlaceholderPage() {
  const { slug } = useParams<{ slug: string }>()
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    getPublicJobBySlug(slug)
      .then(j => {
        if (!j) setNotFound(true)
        else setJob(j)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

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

  return (
    <>
      <Helmet>
        <title>Apply | {job.title} | New Frontiers Talent</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <Eyebrow>Apply</Eyebrow>
        <h1 className="mt-6 text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          Application form coming soon.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          We're putting the finishing touches on the application flow.
          In the meantime, you can email us at{' '}
          <a href={`mailto:${SITE.contactEmail}`} className="text-primary hover:underline">
            {SITE.contactEmail}
          </a>{' '}
          mentioning this role and we'll be in touch.
        </p>

        <div className="rounded-lg border border-border bg-card p-4 mt-6 text-left">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            You're applying for
          </p>
          <p className="text-foreground font-medium">{job.title}</p>
        </div>

        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <Link
            to={`/jobs/${slug}`}
            className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft size={14} />
            Back to role
          </Link>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            Browse other roles
          </Link>
        </div>
      </div>
    </>
  )
}
