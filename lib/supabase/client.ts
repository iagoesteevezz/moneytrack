import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
}

/**
 * Client-safe Supabase instance (uses anon key).
 * Use this for operations that require the authenticated user's RLS context,
 * passing the JWT from the request Authorization header.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,   // serverless — no session storage
    autoRefreshToken: false,
  },
})
