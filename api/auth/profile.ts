import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import type { ApiResponse, Profile, DbProfile } from '../../types/database'

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
})

// ── PATCH /api/auth/profile ──────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['PATCH'])) return

  const ctx = await requireAuth(req, res)
  if (!ctx) return

  const parsed = updateProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      data: null,
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    })
    return
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.fullName !== undefined) updates['full_name'] = parsed.data.fullName
  if (parsed.data.currency !== undefined) updates['currency'] = parsed.data.currency

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ data: null, error: { message: 'No fields to update', code: 'VALIDATION_ERROR' } })
    return
  }

  const { data, error } = await ctx.supabase
    .from('profiles')
    .update(updates)
    .eq('id', ctx.userId)
    .select()
    .single()

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }

  const row = data as DbProfile
  const body: ApiResponse<Profile> = {
    data: {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      currency: row.currency,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    },
    error: null,
  }
  res.status(200).json(body)
}
