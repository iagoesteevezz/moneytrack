import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Wrap in quotes if contains comma, newline or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCSV).join(',')
}

// ── GET /api/export/csv ───────────────────────────────────────
// Query params (all optional):
//   ?from=YYYY-MM-DD
//   ?to=YYYY-MM-DD
//   ?type=income|expense

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET'])) return

  const ctx = await requireAuth(req, res)
  if (!ctx) return

  const { from, to, type } = req.query

  let query = ctx.supabase
    .from('transactions')
    .select(`
      id,
      type,
      amount,
      description,
      date,
      created_at,
      category:categories(name)
    `)
    .order('date', { ascending: false })

  if (typeof from === 'string') query = query.gte('date', from)
  if (typeof to   === 'string') query = query.lte('date', to)
  if (type === 'income' || type === 'expense') query = query.eq('type', type)

  const { data, error } = await query

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message } })
    return
  }

  // Build CSV
  const header = row('ID', 'Fecha', 'Tipo', 'Categoría', 'Descripción', 'Importe (EUR)')
  const lines = (data as any[]).map(tx =>
    row(
      tx.id,
      tx.date,
      tx.type === 'income' ? 'Ingreso' : 'Gasto',
      tx.category?.name ?? '',
      tx.description ?? '',
      tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount),
    )
  )

  const csv = [header, ...lines].join('\n')
  const filename = `moneytrack_${from ?? 'all'}_${to ?? 'all'}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.status(200).send('﻿' + csv)  // BOM for Excel compatibility
}
