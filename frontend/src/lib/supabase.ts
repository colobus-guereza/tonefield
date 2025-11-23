import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vrtcrllfpzialixakhrl.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydGNybGxmcHppYWxpeGFraHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjA2NzAsImV4cCI6MjA3OTEzNjY3MH0.ZDu43V2nql15ghfPcMO_wY35RZ3RO-X9TlmkpHXzD9A'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
