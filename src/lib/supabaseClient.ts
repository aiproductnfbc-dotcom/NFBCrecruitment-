import { createClient } from '@supabase/supabase-js'

// In the browser (Vite), VITE_* vars are injected into import.meta.env.
// In Node.js test scripts (tsx + dotenv), process.env is available instead.
const supabaseUrl: string = import.meta.env?.VITE_SUPABASE_URL ?? ''
const supabaseKey: string = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('[supabaseClient] Missing Supabase credentials. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
