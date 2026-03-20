import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://hbuxgqnbbheyuwxmquvp.supabase.co"
const supabaseKey = "sb_publishable_xA_NioJpy7-1JjhwipHUGA_Z40yHkCU"

export const supabase = createClient(supabaseUrl, supabaseKey)