import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Section from '../primitives/Section'
import SectionHeading from '../primitives/SectionHeading'
import FadeIn from '../primitives/FadeIn'
import PublicJobCard from '../jobs/PublicJobCard'
import { listFeaturedPublicJobs, type PublicJob } from '../../../lib/publicJobsService'

export default function OpenRolesTeaser() {
  const [jobs, setJobs] = useState<PublicJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listFeaturedPublicJobs(6)
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Section id="open-roles" className="bg-muted/30 border-y border-border">
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Section>
    )
  }

  if (jobs.length === 0) {
    return (
      <Section id="open-roles" className="bg-muted/30 border-y border-border">
        <p className="text-center text-muted-foreground">
          Check back soon for new openings.
        </p>
      </Section>
    )
  }

  return (
    <Section id="open-roles" className="bg-muted/30 border-y border-border">
      <div className="flex justify-between items-end gap-6 flex-wrap mb-14">
        <div className="[&>div]:mb-0">
          <SectionHeading
            eyebrow="Currently hiring"
            title="A few of the roles open right now."
            align="left"
          />
        </div>
        <Link
          to="/jobs"
          className="text-primary font-medium inline-flex items-center gap-1 text-sm hover:gap-2 transition-all shrink-0"
        >
          View all open roles
          <ArrowRight size={14} />
        </Link>
      </div>
      <FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(job => (
            <PublicJobCard key={job.id} job={job} />
          ))}
        </div>
      </FadeIn>
    </Section>
  )
}
