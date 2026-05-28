import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import { updateTransactionSchema } from '../../lib/validations/transaction'
import type { ApiResponse, Transaction, DbTransaction, DbCategory } from '../../types/database'

// ── GET /api/transactions/:id ────────────────────────────────

async function handleGet(req: VercelRequest, res: VercelResponse, id: string, supabase: any): Promise<void> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`*, category:categories(id, name, icon, color)`)
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') {
    // PostgREST: no rows — either not found or RLS filtered it out (same 404, no info leak)
    res.status(404).json({ data: null, error: { message: 'Transaction not found', code: 'NOT_FOUND' } })
    return
  }
  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }

  const body: ApiResponse<Transaction> = { data: mapTransaction(data), error: null }
  res.status(200).json(body)
}

// ── PATCH /api/transactions/:id ──────────────────────────────

async function handlePatch(req: VercelRequest, res: VercelResponse, id: string, supabase: any): Promise<void> {
  const parsed = updateTransactionSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      data: null,
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    })
    return
  }

  // Build the update payload — only include fields that were sent
  const { categoryId, type, amount, description, date } = parsed.data
  const updates: Record<string, unknown> = {}
  if (categoryId !== undefined) updates['category_id'] = categoryId
  if (type !== undefined) updates['type'] = type
  if (amount !== undefined) updates['amount'] = amount
  if (description !== undefined) updates['description'] = description
  if (date !== undefined) updates['date'] = date

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ data: null, error: { message: 'No fields to update', code: 'VALIDATION_ERROR' } })
    return
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select(`*, category:categories(id, name, icon, color)`)
    .single()

  if (error?.code === 'PGRST116') {
    res.status(404).json({ data: null, error: { message: 'Transaction not found', code: 'NOT_FOUND' } })
    return
  }
  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }

  const body: ApiResponse<Transaction> = { data: mapTransaction(data), error: null }
  res.status(200).json(body)
}

// ── DELETE /api/transactions/:id ─────────────────────────────

async function handleDelete(req: VercelRequest, res: VercelResponse, id: string, supabase: any): Promise<void> {
  // count: 'exact' lets us detect if RLS silently blocked the delete
  const { error, count } = await supabase
    .from('transactions')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }
  if (count === 0) {
    res.status(404).json({ data: null, error: { message: 'Transaction not found', code: 'NOT_FOUND' } })
    return
  }

  res.status(204).end()
}

// ── Handler ──────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET', 'PATCH', 'DELETE'])) return

  const ctx = await requireAuth(req, res)
  if (!ctx) return

  const id = req.query['id']
  if (typeof id !== 'string') {
    res.status(400).json({ data: null, error: { message: 'Invalid transaction ID', code: 'BAD_REQUEST' } })
    return
  }

  if (req.method === 'GET') return handleGet(req, res, id, ctx.supabase)
  if (req.method === 'PATCH') return handlePatch(req, res, id, ctx.supabase)
  if (req.method === 'DELETE') return handleDelete(req, res, id, ctx.supabase)
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
