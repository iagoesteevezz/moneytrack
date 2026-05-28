import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import type { ApiResponse, Profile, DbProfile } from '../../types/database'

// ── GET /api/auth/me ─────────────────────────────────────────
// Returns the authenticated user's profile.
// The trigger handle_new_user() guarantees a profile exists for every auth user.

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET'])) return

  const ctx = await requireAuth(req, res)
  if (!ctx) return

  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('*')
    .eq('id', ctx.userId)
    .single()

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }

  const body: ApiResponse<Profile> = { data: mapProfile(data as DbProfile), error: null }
  res.status(200).json(body)
}

function mapProfile(row: DbProfile): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    currency: row.currency,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}
