import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import type { ApiError } from '../../types/database'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export interface AuthenticatedContext {
  userId: string
  supabase: ReturnType<typeof createClient>
}

/**
 * Extracts and validates the Bearer JWT from the request.
 * Returns an authenticated Supabase client scoped to that user's RLS context.
 *
 * Usage in any API route:
 *   const ctx = await requireAuth(req, res)
 *   if (!ctx) return  // response already sent
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthenticatedContext | null> {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    const body: ApiError = { data: null, error: { message: 'Missing authorization header', code: 'UNAUTHORIZED' } }
    res.status(401).json(body)
    return null
  }

  const token = authHeader.slice(7)

  // Create a per-request client with the user's JWT — this activates RLS
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error } = await client.auth.getUser()

  if (error || !user) {
    const body: ApiError = { data: null, error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' } }
    res.status(401).json(body)
    return null
  }

  return { userId: user.id, supabase: client }
}

/**
 * Allowed HTTP methods guard.
 * Returns false and sends 405 if the method is not in the allowed list.
 */
export function allowMethods(
  req: VercelRequest,
  res: VercelResponse,
  methods: string[]
): boolean {
  if (!methods.includes(req.method ?? '')) {
    res.setHeader('Allow', methods.join(', '))
    res.status(405).json({ data: null, error: { message: `Method ${req.method} not allowed` } })
    return false
  }
  return true
}
