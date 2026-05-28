import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import { createCategorySchema } from '../../lib/validations/category'
import type { ApiResponse, Category, DbCategory } from '../../types/database'

// ── GET /api/categories ──────────────────────────────────────
// Returns system categories + user's own, merged and sorted.
// Query params:
//   ?type=income|expense|both  (filter by category type)

async function handleGet(req: VercelRequest, res: VercelResponse, userId: string, supabase: any): Promise<void> {
  const { type } = req.query

  // RLS policy handles the filtering:
  // "system_default = true OR user_id = auth.uid()"
  let query = supabase
    .from('categories')
    .select('*')
    .order('system_default', { ascending: false })  // system first
    .order('name', { ascending: true })

  if (type === 'income' || type === 'expense' || type === 'both') {
    // also return 'both' categories regardless of filter
    query = query.in('type', [type, 'both'])
  }

  const { data, error } = await query

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }

  const body: ApiResponse<Category[]> = {
    data: (data as DbCategory[]).map(mapCategory),
    error: null,
  }
  res.status(200).json(body)
}

// ── POST /api/categories ─────────────────────────────────────

async function handlePost(req: VercelRequest, res: VercelResponse, userId: string, supabase: any): Promise<void> {
  const parsed = createCategorySchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      data: null,
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    })
    return
  }

  const { name, icon, color, type } = parsed.data

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name,
      icon: icon ?? null,
      color: color ?? null,
      type,
      system_default: false,
    })
    .select()
    .single()

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }

  const body: ApiResponse<Category> = { data: mapCategory(data), error: null }
  res.status(201).json(body)
}

// ── Handler ──────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET', 'POST'])) return

  const ctx = await requireAuth(req, res)
  if (!ctx) return

  if (req.method === 'GET') return handleGet(req, res, ctx.userId, ctx.supabase)
  if (req.method === 'POST') return handlePost(req, res, ctx.userId, ctx.supabase)
}

// ── Mapper ───────────────────────────────────────────────────

function mapCategory(row: DbCategory): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type,
    isSystemDefault: row.system_default,
    createdAt: new Date(row.created_at),
  }
}
