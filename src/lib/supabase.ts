import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('[BioChain] Supabase config missing — running in offline/local mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY in your .env file to enable cloud sync.');
}

// Use placeholder values when credentials are missing so the app loads in offline mode
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
)