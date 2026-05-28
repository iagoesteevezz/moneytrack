import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import type { ApiResponse, MonthlySummary, CategoryBreakdown } from '../../types/database'

interface SummaryResponse {
  period: { from: string; to: string }
  summary: MonthlySummary
  breakdown: {
    income: CategoryBreakdown[]
    expense: CategoryBreakdown[]
  }
}

// ── GET /api/stats/summary ───────────────────────────────────
// Query params:
//   ?month=YYYY-MM  (defaults to current month)

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET'])) return

  const ctx = await requireAuth(req, res)
  if (!ctx) return

  // Parse and validate the month param
  const rawMonth = req.query['month']
  const month = typeof rawMonth === 'string' && /^\d{4}-\d{2}$/.test(rawMonth)
    ? rawMonth
    : new Date().toISOString().slice(0, 7)

  const from = `${month}-01`
  // Last day of the month: go to first of next month, subtract 1 day
  const to = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10)

  // Single query: aggregate totals + category breakdown in one round-trip
  const { data, error } = await ctx.supabase
    .from('transactions')
    .select(`
      type,
      amount,
      category:categories(id, name, icon, color)
    `)
    .gte('date', from)
    .lte('date', to)

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message, code: error.code } })
    return
  }

  // Aggregate in-process — avoids complex SQL and keeps the logic testable
  let totalIncome = 0
  let totalExpense = 0

  const incomeMap = new Map<string, CategoryBreakdown>()
  const expenseMap = new Map<string, CategoryBreakdown>()

  for (const row of data as any[]) {
    const amount = Number(row.amount)
    const cat = row.category as { id: string; name: string; icon: string | null; color: string | null } | null
    const categoryId = cat?.id ?? 'uncategorized'
    const categoryName = cat?.name ?? 'Sin categoría'

    if (row.type === 'income') {
      totalIncome += amount
      const existing = incomeMap.get(categoryId)
      if (existing) {
        existing.total += amount
        existing.count++
      } else {
        incomeMap.set(categoryId, {
          categoryId,
          categoryName,
          icon: cat?.icon ?? null,
          color: cat?.color ?? null,
          total: amount,
          percentage: 0,   // calculated below
          count: 1,
        })
      }
    } else {
      totalExpense += amount
      const existing = expenseMap.get(categoryId)
      if (existing) {
        existing.total += amount
        existing.count++
      } else {
        expenseMap.set(categoryId, {
          categoryId,
          categoryName,
          icon: cat?.icon ?? null,
          color: cat?.color ?? null,
          total: amount,
          percentage: 0,
          count: 1,
        })
      }
    }
  }

  // Calculate percentages and sort by total desc
  const calcPercentages = (map: Map<string, CategoryBreakdown>, total: number): CategoryBreakdown[] =>
    Array.from(map.values())
      .map(b => ({ ...b, percentage: total > 0 ? Math.round((b.total / total) * 10000) / 100 : 0 }))
      .sort((a, b) => b.total - a.total)

  const body: ApiResponse<SummaryResponse> = {
    data: {
      period: { from, to },
      summary: {
        month,
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        balance: Math.round((totalIncome - totalExpense) * 100) / 100,
      },
      breakdown: {
        income: calcPercentages(incomeMap, totalIncome),
        expense: calcPercentages(expenseMap, totalExpense),
      },
    },
    error: null,
  }

  res.status(200).json(body)
}
