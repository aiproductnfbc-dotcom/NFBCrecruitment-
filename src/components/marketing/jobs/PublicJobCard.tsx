import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Wifi, Clock, Banknote } from 'lucide-react'
import type { PublicJob } from '../../../lib/publicJobsService'
import { formatSalary, timeAgo } from '../../../lib/publicJobsService'

const REMOTE_LABELS: Record<string, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
}

export default function PublicJobCard({ job }: { job: PublicJob }) {
  const salary = formatSalary(job)
  const posted = job.published_at ? timeAgo(job.published_at) : null

  return (
    <Link
      to={`/jobs/${job.slug}`}
      className="group flex flex-col h-full rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between gap-2">
        {job.employment_type && (
          <span className="rounded-full bg-secondary/40 text-secondary-foreground px-2.5 py-1 text-xs font-medium uppercase tracking-wider">
            {job.employment_type}
          </span>
        )}
        {posted && (
          <span className="text-xs text-muted-foreground/80 inline-flex items-center gap-1">
            <Clock size={12} />
            {posted}
          </span>
        )}
      </div>

      <h3 className="mt-4 text-lg font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
        {job.title}
      </h3>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={14} />
            {job.location}
          </span>
        )}
        {job.remote_policy && (
          <span className="inline-flex items-center gap-1">
            <Wifi size={14} />
            {REMOTE_LABELS[job.remote_policy] ?? job.remote_policy}
          </span>
        )}
        {salary && (
          <span className="inline-flex items-center gap-1">
            <Banknote size={14} />
            {salary}
          </span>
        )}
      </div>

      {job.seniority && (
        <span className="mt-3 text-xs text-muted-foreground/70">
          {job.seniority} level
        </span>
      )}

      <span className="mt-auto pt-5 text-sm font-medium text-primary inline-flex items-center gap-1">
        View role
        <ArrowRight
          size={14}
          className="transition-transform duration-200 group-hover:translate-x-1"
        />
      </span>
    </Link>
  )
}
