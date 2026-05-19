import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, CheckCircle2, Mail, Clock, ArrowLeft } from 'lucide-react'
import Eyebrow from '../../components/marketing/primitives/Eyebrow'
import FadeIn from '../../components/marketing/primitives/FadeIn'
import Section from '../../components/marketing/primitives/Section'
import {
  Input, Textarea, Select, RadioGroup, Checkbox,
  FormField, FormSection,
} from '../../components/marketing/forms'
import {
  validateRequired, validateEmail, validatePhone, validateMaxLength,
  type FieldErrors,
} from '../../components/marketing/forms/validation'
import {
  submitMarketingInquiry,
  type HiringInquiry, type CandidateInquiry, type InquiryType,
} from '../../lib/marketingInquiriesService'
import { INDUSTRIES } from '../../content/marketing/industries'
import { SITE } from '../../content/marketing/site'

const HERO_COPY = {
  hiring: {
    title: 'Tell us about the role.',
    subhead: "We'll come back within one business day with next steps.",
  },
  candidate: {
    title: 'Send us your details.',
    subhead: "We'll keep you in mind for the right opportunity.",
  },
} as const

const INDUSTRY_OPTIONS = INDUSTRIES.map(i => ({ value: i.name, label: i.name }))
const HEADCOUNT_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2-5', label: '2–5' },
  { value: '6-10', label: '6–10' },
  { value: '10+', label: '10+' },
]
const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '1-3-months', label: '1–3 months' },
  { value: '3-6-months', label: '3–6 months' },
  { value: 'exploring', label: 'Just exploring' },
]
const EXPERIENCE_OPTIONS = [
  { value: '0-2', label: '0–2 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '6-10', label: '6–10 years' },
  { value: '10+', label: '10+ years' },
]
const OPEN_TO_OPTIONS = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'either', label: 'Either' },
]

function InfoStrip({ type }: { type: InquiryType }) {
  return (
    <div className="hidden lg:block lg:sticky lg:top-32 self-start space-y-8">
      <div>
        <Eyebrow>Other ways to reach us</Eyebrow>
        <div className="mt-4 rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Mail size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Email</p>
              <p className="text-sm text-muted-foreground">{SITE.contactEmail}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Office hours</p>
              <p className="text-sm text-muted-foreground">Sun–Thu, 9am–6pm</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">What happens next?</p>
        <ol className="space-y-2.5 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="font-mono text-primary text-xs mt-0.5">1</span>
            We read every inquiry within 1 business day
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-primary text-xs mt-0.5">2</span>
            A specialist recruiter follows up directly
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-primary text-xs mt-0.5">3</span>
            We come back with a plan, a shortlist, or both
          </li>
        </ol>
      </div>

      {type === 'candidate' && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground italic">
            We treat every conversation as confidential.
          </p>
        </div>
      )}
    </div>
  )
}

export default function ContactPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const type: InquiryType = searchParams.get('type') === 'candidate' ? 'candidate' : 'hiring'

  const [values, setValues] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [topError, setTopError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  function setType(t: InquiryType) {
    setSearchParams({ type: t }, { replace: true })
    setErrors({})
    setTopError(null)
  }

  function field(name: string) {
    return {
      id: name,
      value: values[name] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setValues(v => ({ ...v, [name]: e.target.value })),
      error: !!errors[name],
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTopError(null)

    // Honeypot
    const formData = new FormData(e.currentTarget)
    const honey = (formData.get('website') as string | null) ?? ''
    if (honey.length > 0) {
      setSuccess(true)
      return
    }

    // Validate
    const next: FieldErrors = {}
    next.full_name = validateRequired(values.full_name, 'Full name')
    next.email = validateRequired(values.email, 'Email') ?? validateEmail(values.email)
    next.phone = validatePhone(values.phone)
    next.message = validateMaxLength(values.message, 4000, 'Message')
    setErrors(next)

    if (Object.values(next).some(Boolean)) {
      setTopError('Please fix the highlighted fields.')
      return
    }

    setSubmitting(true)

    const base = {
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      phone: values.phone?.trim() || undefined,
      message: values.message?.trim() || undefined,
      consent_marketing: consent,
    }

    const inquiry: HiringInquiry | CandidateInquiry =
      type === 'hiring'
        ? {
            ...base,
            type: 'hiring',
            company: values.company?.trim() || undefined,
            role_title: values.role_title?.trim() || undefined,
            headcount: (values.headcount as HiringInquiry['headcount']) || undefined,
            timeline: (values.timeline as HiringInquiry['timeline']) || undefined,
            industry: values.industry || undefined,
          }
        : {
            ...base,
            type: 'candidate',
            current_role: values.current_role?.trim() || undefined,
            years_experience: (values.years_experience as CandidateInquiry['years_experience']) || undefined,
            location_preference: values.location_preference?.trim() || undefined,
            open_to: (values.open_to as CandidateInquiry['open_to']) || undefined,
          }

    const result = await submitMarketingInquiry(inquiry, {
      user_agent: navigator.userAgent,
      referrer: document.referrer || undefined,
    })

    setSubmitting(false)
    if (result.ok) setSuccess(true)
    else setTopError(result.error || 'Something went wrong. Please try again.')
  }

  function resetForm() {
    setValues({})
    setConsent(false)
    setErrors({})
    setTopError(null)
    setSuccess(false)
  }

  const hero = HERO_COPY[type]

  return (
    <>
      <Helmet>
        <title>Contact | New Frontiers Talent</title>
        <meta
          name="description"
          content="Get in touch with New Frontiers Talent. Tell us about a role you're hiring for, or send us your CV."
        />
      </Helmet>

      {/* Hero */}
      <section className="relative pt-24 md:pt-32 pb-8 md:pb-12">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, var(--primary) 0%, transparent 70%)',
            opacity: 0.05,
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6">
          <FadeIn key={type}>
            <Eyebrow>Contact</Eyebrow>
            <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.08]">
              {hero.title}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              {hero.subhead}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Segmented control */}
      <div className="mx-auto max-w-4xl px-6 mb-8">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setType('hiring')}
            className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
              type === 'hiring'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            I'm hiring
          </button>
          <button
            onClick={() => setType('candidate')}
            className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
              type === 'candidate'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            I'm a candidate
          </button>
        </div>
      </div>

      {/* Form + info strip */}
      <Section>
        <div className="grid lg:grid-cols-[7fr_5fr] gap-12 lg:gap-16">
          <div>
            {success ? (
              <FadeIn key="success">
                <div className="text-center py-12">
                  <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                    <CheckCircle2 size={32} className="text-primary" />
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold text-foreground">
                    Thanks — we've got it.
                  </h2>
                  <p className="mt-3 text-muted-foreground max-w-md mx-auto">
                    {type === 'hiring'
                      ? "We'll come back to you within one business day."
                      : "We'll be in touch when we have something that fits."}
                  </p>
                  <div className="mt-8 flex gap-3 justify-center flex-wrap">
                    <button
                      onClick={resetForm}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      Send another inquiry
                    </button>
                    <Link
                      to="/"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      <ArrowLeft size={14} />
                      Back to home
                    </Link>
                  </div>
                </div>
              </FadeIn>
            ) : (
              <form onSubmit={onSubmit} noValidate className="space-y-10">
                {topError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {topError}
                  </div>
                )}

                {/* Honeypot */}
                <div className="absolute -left-[9999px]" aria-hidden="true" tabIndex={-1}>
                  <label htmlFor="website">Website</label>
                  <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
                </div>

                {type === 'hiring' ? (
                  <>
                    <FormSection title="About you">
                      <FormField id="full_name" label="Full name" required error={errors.full_name}>
                        <Input {...field('full_name')} type="text" placeholder="Your full name" />
                      </FormField>
                      <FormField id="email" label="Email" required error={errors.email}>
                        <Input {...field('email')} type="email" placeholder="you@company.com" />
                      </FormField>
                      <FormField id="phone" label="Phone" error={errors.phone}>
                        <Input {...field('phone')} type="tel" placeholder="+971 ..." />
                      </FormField>
                      <FormField id="company" label="Company">
                        <Input {...field('company')} type="text" placeholder="Company name" />
                      </FormField>
                    </FormSection>

                    <FormSection title="About the role">
                      <FormField id="role_title" label="Role title">
                        <Input {...field('role_title')} type="text" placeholder="e.g. Senior Software Engineer" />
                      </FormField>
                      <FormField id="industry" label="Industry">
                        <Select {...field('industry')} options={INDUSTRY_OPTIONS} placeholder="— Select industry —" />
                      </FormField>
                      <FormField id="headcount" label="Number of hires">
                        <Select {...field('headcount')} options={HEADCOUNT_OPTIONS} placeholder="— How many? —" />
                      </FormField>
                      <FormField id="timeline" label="Timeline">
                        <Select {...field('timeline')} options={TIMELINE_OPTIONS} placeholder="— When do you need them? —" />
                      </FormField>
                    </FormSection>

                    <FormSection title="Anything else?" cols={1}>
                      <FormField id="message" label="Message" error={errors.message}>
                        <Textarea
                          {...field('message')}
                          placeholder="Tell us about the role, the team, and what you're looking for."
                        />
                      </FormField>
                    </FormSection>
                  </>
                ) : (
                  <>
                    <FormSection title="About you">
                      <FormField id="full_name" label="Full name" required error={errors.full_name}>
                        <Input {...field('full_name')} type="text" placeholder="Your full name" />
                      </FormField>
                      <FormField id="email" label="Email" required error={errors.email}>
                        <Input {...field('email')} type="email" placeholder="you@email.com" />
                      </FormField>
                      <FormField id="phone" label="Phone" error={errors.phone}>
                        <Input {...field('phone')} type="tel" placeholder="+971 ..." />
                      </FormField>
                      <FormField id="location_preference" label="Preferred location">
                        <Input {...field('location_preference')} type="text" placeholder="City, country, or 'remote'" />
                      </FormField>
                    </FormSection>

                    <FormSection title="Your background">
                      <FormField id="current_role" label="Current role">
                        <Input {...field('current_role')} type="text" placeholder="Your current title" />
                      </FormField>
                      <FormField id="years_experience" label="Years of experience">
                        <Select {...field('years_experience')} options={EXPERIENCE_OPTIONS} placeholder="— Select —" />
                      </FormField>
                      <FormField id="industry" label="Industry">
                        <Select {...field('industry')} options={INDUSTRY_OPTIONS} placeholder="— Select industry —" />
                      </FormField>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1.5">Open to</p>
                        <RadioGroup
                          name="open_to"
                          value={values.open_to || ''}
                          onChange={v => setValues(prev => ({ ...prev, open_to: v }))}
                          options={OPEN_TO_OPTIONS}
                          orientation="horizontal"
                        />
                      </div>
                    </FormSection>

                    <FormSection title="A bit more" cols={1}>
                      <FormField id="message" label="Message" error={errors.message}>
                        <Textarea
                          {...field('message')}
                          placeholder="Tell us what you're looking for, and link to your LinkedIn or portfolio if you'd like."
                        />
                      </FormField>
                    </FormSection>
                  </>
                )}

                <div className="space-y-6">
                  <Checkbox
                    id="consent_marketing"
                    checked={consent}
                    onChange={setConsent}
                    label="I'd like NFT to occasionally contact me about relevant talent insights."
                  />

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending...' : 'Send inquiry'}
                    {!submitting && <ArrowRight size={16} />}
                  </button>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    By submitting this form, you agree to our{' '}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                    We use your details only to respond to your inquiry.
                    {type === 'candidate' && (
                      <> We never share your details with a client without your explicit go-ahead.</>
                    )}
                  </p>
                </div>
              </form>
            )}
          </div>

          <InfoStrip type={type} />
        </div>
      </Section>
    </>
  )
}
