import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import { createTransactionSchema } from '../../lib/validations/transaction'
import type { ApiResponse, Transaction, DbTransaction, DbCategory } from '../../types/database'

// ── GET /api/transactions ────────────────────────────────────
// Query params:
//   ?type=income|expense
//   ?category_id=uuid
//   ?from=YYYY-MM-DD
//   ?to=YYYY-MM-DD
//   ?limit=50 (default)
//   ?offset=0 (default)

async function handleGet(req: VercelRequest, res: VercelResponse, userId: string, supabase: any): Promise<void> {
  const { type, category_id, from, to, limit = '50', offset = '0' } = req.query

  let query = supabase
    .from('transactions')
    .select(`
      *,
      category:categories(id, name, icon, color)
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (type === 'income' || type === 'expense') {
    query = query.eq('type', type)
  }
  if (typeof category_id === 'string') {
    query = query.eq('category_id', category_id)
  }
  if (typeof from === 'string') {
    query = query.gte('date', from)
  }
  if (typeof to === 'string') {
    query = query.lte('date', to)
  }

  const { data, error, count } = await query

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }

  const transactions = (data as (DbTransaction & { category: DbCategory | null })[]).map(mapTransaction)

  res.status(200).json({
    data: transactions,
    meta: { limit: Number(limit), offset: Number(offset), total: count ?? transactions.length },
    error: null,
  })
}

// ── POST /api/transactions ───────────────────────────────────

async function handlePost(req: VercelRequest, res: VercelResponse, userId: string, supabase: any): Promise<void> {
  const parsed = createTransactionSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      data: null,
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    })
    return
  }

  const { categoryId, type, amount, description, date } = parsed.data

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      category_id: categoryId ?? null,
      type,
      amount,
      description: description ?? null,
      date: date ?? new Date().toISOString().slice(0, 10),
    })
    .select(`*, category:categories(id, name, icon, color)`)
    .single()

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }

  const body: ApiResponse<Transaction> = { data: mapTransaction(data), error: null }
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

function mapTransaction(row: DbTransaction & { category?: DbCategory | null }): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    category: row.category
      ? { id: row.category.id, name: row.category.name, icon: row.category.icon, color: row.category.color }
      : undefined,
    type: row.type,
    amount: Number(row.amount),
    description: row.description,
    date: new Date(row.date),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}
