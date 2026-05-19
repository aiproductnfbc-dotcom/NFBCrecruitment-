import { supabase } from './supabaseClient'

export type InquiryType = 'hiring' | 'candidate'

export interface BaseInquiry {
  type: InquiryType
  full_name: string
  email: string
  phone?: string
  company?: string
  message?: string
  consent_marketing: boolean
}

export interface HiringInquiry extends BaseInquiry {
  type: 'hiring'
  role_title?: string
  headcount?: '1' | '2-5' | '6-10' | '10+'
  timeline?: 'asap' | '1-3-months' | '3-6-months' | 'exploring'
  industry?: string
}

export interface CandidateInquiry extends BaseInquiry {
  type: 'candidate'
  current_role?: string
  years_experience?: '0-2' | '3-5' | '6-10' | '10+'
  location_preference?: string
  open_to?: 'permanent' | 'contract' | 'either'
}

export type Inquiry = HiringInquiry | CandidateInquiry

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function submitMarketingInquiry(
  inquiry: Inquiry,
  metadata?: { user_agent?: string; referrer?: string }
): Promise<SubmitResult> {
  try {
    const { data, error } = await supabase
      .from('marketing_inquiries')
      .insert({
        ...inquiry,
        user_agent: metadata?.user_agent,
        referrer: metadata?.referrer,
      })
      .select('id')
      .single()

    if (error) {
      if (import.meta.env.DEV) console.error('[marketingInquiries] insert error:', error)
      if (error.code === '23514') return { ok: false, error: 'Please check all required fields are filled correctly.' }
      if (error.code === '42501') return { ok: false, error: 'Submission not allowed. Please try again later.' }
      return { ok: false, error: 'Something went wrong. Please try again.' }
    }

    return { ok: true, id: data.id }
  } catch (err) {
    if (import.meta.env.DEV) console.error('[marketingInquiries] unexpected error:', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
