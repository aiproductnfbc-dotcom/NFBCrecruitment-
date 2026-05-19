import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import {
  ArrowLeft, Loader2, Send, MapPin, Briefcase, Wifi,
  CheckCircle2, Shield, Clock, AlertCircle,
} from 'lucide-react'
import Section from '../../components/marketing/primitives/Section'
import Eyebrow from '../../components/marketing/primitives/Eyebrow'
import FormSection from '../../components/marketing/forms/FormSection'
import FormField from '../../components/marketing/forms/FormField'
import Input from '../../components/marketing/forms/Input'
import Textarea from '../../components/marketing/forms/Textarea'
import Checkbox from '../../components/marketing/forms/Checkbox'
import FileUploadField from '../../components/marketing/forms/FileUploadField'
import {
  getPublicJobBySlug, type PublicJob,
} from '../../lib/publicJobsService'
import { SITE } from '../../content/marketing/site'

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001'
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-public-application`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const REMOTE_LABELS: Record<string, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
}

interface FormData {
  full_name: string
  email: string
  phone: string
  location: string
  linkedin_url: string
  cover_message: string
  cv_storage_path: string
  consent: boolean
  website: string // honeypot
}

const INITIAL: FormData = {
  full_name: '',
  email: '',
  phone: '',
  location: '',
  linkedin_url: '',
  cover_message: '',
  cv_storage_path: '',
  consent: false,
  website: '',
}

function validate(d: FormData): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.full_name.trim()) e.full_name = 'Full name is required.'
  else if (d.full_name.length > 200) e.full_name = 'Must be under 200 characters.'
  if (!d.email.trim()) e.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = 'Enter a valid email address.'
  if (!d.phone.trim()) e.phone = 'Phone number is required.'
  else if (d.phone.length < 5) e.phone = 'Phone number is too short.'
  else if (d.phone.length > 30) e.phone = 'Phone number is too long.'
  if (d.linkedin_url.trim()) {
    const u = d.linkedin_url.trim()
    if (!u.startsWith('https://www.linkedin.com/') && !u.startsWith('https://linkedin.com/')) {
      e.linkedin_url = 'Must be a LinkedIn URL (https://linkedin.com/…)'
    }
  }
  if (d.cover_message.length > 2000) e.cover_message = 'Must be under 2,000 characters.'
  if (!d.cv_storage_path) e.cv_storage_path = 'Please upload your CV.'
  if (!d.consent) e.consent = 'You must consent to proceed.'
  return e
}

export default function JobApplyPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [job, setJob] = useState<PublicJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState<FormData>(INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<{ type: 'error' | 'info'; message: string; linkTo?: string; linkLabel?: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'submitting'>('idle')
  const [rateLimitedUntil, setRateLimitedUntil] = useState(0)

  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRef = useRef<HCaptcha>(null)

  // Detect dark mode for hCaptcha theme
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Fetch job
  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getPublicJobBySlug(slug)
      .then(j => { if (!j) setNotFound(true); else setJob(j) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  const set = useCallback(<K extends keyof FormData>(k: K, v: FormData[K]) => {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => {
      if (!prev[k]) return prev
      const next = { ...prev }
      delete next[k]
      return next
    })
    setBanner(null)
  }, [])

  const handleSubmit = async () => {
    if (submitting) return

    // Honeypot
    if (form.website) {
      navigate(`/jobs/${slug}/applied`)
      return
    }

    // Client validation
    const errs = validate(form)
    if (!captchaToken) errs._captcha = 'Please complete the captcha.'
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setBanner({ type: 'error', message: 'Please fix the highlighted fields.' })
      return
    }

    setSubmitting(true)
    setSubmitPhase('submitting')
    setBanner(null)

    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_slug: slug,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          location: form.location.trim() || undefined,
          linkedin_url: form.linkedin_url.trim() || undefined,
          cover_message: form.cover_message.trim() || undefined,
          cv_storage_path: form.cv_storage_path,
          consent: form.consent,
          captcha_token: captchaToken,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data.ok) {
        navigate(`/jobs/${slug}/applied`)
        return
      }

      // Error handling
      if (res.status === 400) {
        if (data.code === 'validation_error' && data.fields) {
          const fieldErrors: Record<string, string> = {}
          for (const f of data.fields as { field: string; error: string }[]) {
            fieldErrors[f.field] = f.error
          }
          setErrors(fieldErrors)
          setBanner({ type: 'error', message: 'Please fix the highlighted fields.' })
        } else if (data.code === 'captcha_failed') {
          captchaRef.current?.resetCaptcha()
          setCaptchaToken('')
          setBanner({ type: 'error', message: 'Captcha verification failed. Please try again.' })
        } else if (data.code === 'job_not_found') {
          setBanner({
            type: 'error',
            message: 'This role is no longer accepting applications.',
            linkTo: '/jobs',
            linkLabel: 'Browse other open roles',
          })
        } else {
          setBanner({ type: 'error', message: data.error || 'Something went wrong. Please try again.' })
        }
      } else if (res.status === 409) {
        setBanner({ type: 'info', message: "We've already received your application for this role. We'll be in touch." })
      } else if (res.status === 429) {
        setRateLimitedUntil(Date.now() + 60_000)
        setBanner({ type: 'error', message: 'Too many requests. Please try again in a few minutes.' })
      } else {
        setBanner({
          type: 'error',
          message: `Something went wrong. Please try again, or email us at ${SITE.contactEmail}.`,
        })
      }
    } catch {
      setBanner({
        type: 'error',
        message: "Couldn't reach our servers. Check your connection and try again.",
      })
    } finally {
      setSubmitting(false)
      setSubmitPhase('idle')
    }
  }

  const isRateLimited = rateLimitedUntil > Date.now()
  const canSubmit =
    !submitting &&
    !isRateLimited &&
    form.full_name.trim() !== '' &&
    form.email.trim() !== '' &&
    form.phone.trim() !== '' &&
    form.cv_storage_path !== '' &&
    form.consent &&
    captchaToken !== ''

  // ── Loading / Not found ────────────────────────────────────────────────────

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
          <p className="text-muted-foreground mb-6">This position may have been filled or removed.</p>
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

  // ── Main form ──────���───────────────────────────────────────────────────────

  return (
    <>
      <Helmet>
        <title>Apply | {job.title} | New Frontiers Talent</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <Section className="pt-24 md:pt-32 pb-16">
        {/* Back link */}
        <Link
          to={`/jobs/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Back to role
        </Link>

        {/* Page hero */}
        <div className="mb-10">
          <Eyebrow>Apply</Eyebrow>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            {job.title}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Takes about 3 minutes. No account needed.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Sidebar — on top on mobile, sticky on lg */}
          <aside className="lg:col-span-5 lg:order-2 space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* Role recap */}
            <div className="border border-border rounded-xl bg-card p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                You're applying for
              </p>
              <p className="text-lg font-semibold text-foreground">{job.title}</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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

            {/* What happens next */}
            <div className="border border-border rounded-xl bg-card p-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">What happens next?</p>
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

            {/* Reassurance */}
            <div className="flex items-start gap-2.5 rounded-lg bg-primary/5 border border-primary/10 p-3.5">
              <Shield size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                We never share your CV with a client without your explicit go-ahead.
              </p>
            </div>
          </aside>

          {/* Form */}
          <div className="lg:col-span-7 lg:order-1 space-y-8">
            {/* Banner */}
            {banner && (
              <div className={`flex items-start gap-2.5 rounded-lg border p-4 ${
                banner.type === 'error'
                  ? 'bg-destructive/5 border-destructive/20'
                  : 'bg-primary/5 border-primary/20'
              }`}>
                <AlertCircle size={16} className={`shrink-0 mt-0.5 ${
                  banner.type === 'error' ? 'text-destructive' : 'text-primary'
                }`} />
                <div className="text-sm">
                  <p className={banner.type === 'error' ? 'text-destructive' : 'text-foreground'}>
                    {banner.message}
                  </p>
                  {banner.linkTo && (
                    <Link to={banner.linkTo} className="text-primary hover:underline text-sm mt-1 inline-block">
                      {banner.linkLabel}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* About you */}
            <FormSection title="About you" cols={2}>
              <FormField id="full_name" label="Full name" required error={errors.full_name}>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={e => set('full_name', e.target.value)}
                  maxLength={200}
                  error={!!errors.full_name}
                />
              </FormField>
              <FormField id="email" label="Email" required error={errors.email}>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  error={!!errors.email}
                />
              </FormField>
              <FormField id="phone" label="Phone" required error={errors.phone}>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  error={!!errors.phone}
                />
              </FormField>
              <FormField id="location" label="Location" error={errors.location}>
                <Input
                  id="location"
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="City, country"
                />
              </FormField>
            </FormSection>

            {/* A bit more */}
            <FormSection title="A bit more" cols={2}>
              <FormField id="linkedin_url" label="LinkedIn profile" error={errors.linkedin_url}>
                <Input
                  id="linkedin_url"
                  type="url"
                  value={form.linkedin_url}
                  onChange={e => set('linkedin_url', e.target.value)}
                  placeholder="https://linkedin.com/in/yourname"
                  error={!!errors.linkedin_url}
                />
              </FormField>
              <div className="md:col-span-2">
                <FormField id="cover_message" label="Cover message" error={errors.cover_message}>
                  <Textarea
                    id="cover_message"
                    value={form.cover_message}
                    onChange={e => set('cover_message', e.target.value)}
                    maxLength={2000}
                    rows={6}
                    placeholder="Why this role? Anything we should know?"
                    error={!!errors.cover_message}
                  />
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums text-right">
                    {form.cover_message.length}/2000
                  </p>
                </FormField>
              </div>
            </FormSection>

            {/* Your CV */}
            <FormSection title="Your CV" cols={1}>
              <FileUploadField
                value={form.cv_storage_path}
                onChange={v => set('cv_storage_path', v)}
                error={errors.cv_storage_path}
              />
            </FormSection>

            {/* Consent + Captcha + Honeypot */}
            <div className="space-y-5">
              <div>
                <Checkbox
                  id="consent"
                  checked={form.consent}
                  onChange={v => set('consent', v)}
                  label={
                    <>
                      I consent to NFT processing my personal data and CV for the purpose of
                      this application, in line with the{' '}
                      <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                        Privacy Policy
                      </Link>.
                    </>
                  }
                />
                {errors.consent && (
                  <p className="mt-1.5 text-xs text-destructive pl-8">{errors.consent}</p>
                )}
              </div>

              <div>
                <HCaptcha
                  ref={captchaRef}
                  sitekey={HCAPTCHA_SITE_KEY}
                  theme={isDark ? 'dark' : 'light'}
                  onVerify={token => { setCaptchaToken(token); setErrors(p => { const n = { ...p }; delete n._captcha; return n }) }}
                  onExpire={() => setCaptchaToken('')}
                />
                {errors._captcha && (
                  <p className="mt-1.5 text-xs text-destructive">{errors._captcha}</p>
                )}
              </div>

              {/* Honeypot */}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={e => set('website', e.target.value)}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {submitPhase === 'submitting' ? 'Submitting…' : 'Submitting…'}
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send application
                  </>
                )}
              </button>

              <p className="text-xs text-muted-foreground">
                By submitting, you agree to our{' '}
                <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </Link>.
                We typically respond within one business day.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
