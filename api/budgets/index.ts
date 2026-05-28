import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'

// ── Types ─────────────────────────────────────────────────────

export interface BudgetWithProgress {
  id: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  categoryColor: string | null
  amount: number      // limit set by user
  spent: number       // actual spend this month (from transactions)
  remaining: number   // amount - spent (can be negative)
  percentage: number  // (spent / amount) * 100, capped display-side
  period: 'monthly'
  createdAt: string
  updatedAt: string
}

// ── Validation ────────────────────────────────────────────────

const upsertBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
})

// ── GET /api/budgets ─────────────────────────────────────────
// Returns budgets for the current month, each with real spent amount.
// Query params:
//   ?month=YYYY-MM  (defaults to current month)

async function handleGet(req: VercelRequest, res: VercelResponse, userId: string, supabase: any): Promise<void> {
  const rawMonth = req.query['month']
  const month = typeof rawMonth === 'string' && /^\d{4}-\d{2}$/.test(rawMonth)
    ? rawMonth
    : new Date().toISOString().slice(0, 7)

  const from = `${month}-01`
  const to   = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0)
    .toISOString().slice(0, 10)

  // Fetch budgets with category info
  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select(`
      id,
      amount,
      period,
      created_at,
      updated_at,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('period', 'monthly')

  if (budgetError) {
    res.status(500).json({ data: null, error: { message: budgetError.message } })
    return
  }

  if ((budgets as any[]).length === 0) {
    res.status(200).json({ data: [], error: null })
    return
  }

  // Fetch actual spend for this month for those categories
  const categoryIds = (budgets as any[]).map((b: any) => b.category.id)

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('type', 'expense')
    .in('category_id', categoryIds)
    .gte('date', from)
    .lte('date', to)

  if (txError) {
    res.status(500).json({ data: null, error: { message: txError.message } })
    return
  }

  // Aggregate spend per category in-process
  const spentMap = new Map<string, number>()
  for (const tx of transactions as { category_id: string; amount: number }[]) {
    spentMap.set(tx.category_id, (spentMap.get(tx.category_id) ?? 0) + Number(tx.amount))
  }

  const result: BudgetWithProgress[] = (budgets as any[]).map(b => {
    const spent     = Math.round((spentMap.get(b.category.id) ?? 0) * 100) / 100
    const amount    = Number(b.amount)
    const remaining = Math.round((amount - spent) * 100) / 100
    const percentage = amount > 0 ? Math.round((spent / amount) * 10000) / 100 : 0

    return {
      id:            b.id,
      categoryId:    b.category.id,
      categoryName:  b.category.name,
      categoryIcon:  b.category.icon,
      categoryColor: b.category.color,
      amount,
      spent,
      remaining,
      percentage,
      period:        b.period,
      createdAt:     b.created_at,
      updatedAt:     b.updated_at,
    }
  }).sort((a, b) => b.percentage - a.percentage)   // worst offenders first

  res.status(200).json({ data: result, error: null })
}

// ── POST /api/budgets ─────────────────────────────────────────
// Upserts a monthly budget for a category.
// If one already exists for that category, it updates the amount.

async function handlePost(req: VercelRequest, res: VercelResponse, userId: string, supabase: any): Promise<void> {
  const parsed = upsertBudgetSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      data: null,
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    })
    return
  }

  const { categoryId, amount } = parsed.data

  // Upsert — unique constraint on (user_id, category_id, period)
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: userId, category_id: categoryId, amount, period: 'monthly' },
      { onConflict: 'user_id,category_id,period' }
    )
    .select('id, amount, period, created_at, updated_at, category:categories(id, name, icon, color)')
    .single()

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message } })
    return
  }

  res.status(201).json({ data, error: null })
}

// ── DELETE /api/budgets/:id ───────────────────────────────────

async function handleDelete(req: VercelRequest, res: VercelResponse, supabase: any): Promise<void> {
  const id = req.query['id']
  if (typeof id !== 'string') {
    res.status(400).json({ data: null, error: { message: 'Missing budget id' } })
    return
  }

  const { error, count } = await supabase
    .from('budgets')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message } })
    return
  }
  if (count === 0) {
    res.status(404).json({ data: null, error: { message: 'Budget not found' } })
    return
  }

  res.status(204).end()
}

// ── Handler ───────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET', 'POST', 'DELETE'])) return

  const ctx = await requireAuth(req, res)
  if (!ctx) return

  if (req.method === 'GET')    return handleGet(req, res, ctx.userId, ctx.supabase)
  if (req.method === 'POST')   return handlePost(req, res, ctx.userId, ctx.supabase)
  if (req.method === 'DELETE') return handleDelete(req, res, ctx.supabase)
}
