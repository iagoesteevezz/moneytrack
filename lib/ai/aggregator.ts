/**
 * Aggregates raw transaction rows into a compact summary
 * suitable for sending to the AI without burning tokens.
 *
 * Never sends individual transaction IDs or personal descriptions —
 * only categorical totals and counts.
 */

interface RawTransaction {
  type: 'income' | 'expense'
  amount: number
  date: string         // YYYY-MM-DD
  category_name: string | null
}

export interface MonthlyAggregate {
  month: string        // YYYY-MM
  totalIncome: number
  totalExpense: number
  balance: number
  byCategory: {
    name: string
    type: 'income' | 'expense'
    total: number
    count: number
  }[]
}

export interface AggregatedHistory {
  months: MonthlyAggregate[]
  /** Most recent complete month (not current) */
  latestMonth: string
}

export function aggregateHistory(rows: RawTransaction[]): AggregatedHistory {
  const monthMap = new Map<string, Map<string, { type: 'income' | 'expense'; total: number; count: number }>>()

  for (const row of rows) {
    const month = row.date.slice(0, 7)
    const catName = row.category_name ?? 'Sin categoría'

    if (!monthMap.has(month)) monthMap.set(month, new Map())
    const catMap = monthMap.get(month)!

    const key = `${row.type}::${catName}`
    const existing = catMap.get(key)
    if (existing) {
      existing.total += Number(row.amount)
      existing.count++
    } else {
      catMap.set(key, { type: row.type, total: Number(row.amount), count: 1 })
    }
  }

  const months: MonthlyAggregate[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, catMap]) => {
      const byCategory = Array.from(catMap.entries()).map(([key, v]) => ({
        name: key.split('::')[1]!,
        type: v.type,
        total: Math.round(v.total * 100) / 100,
        count: v.count,
      }))

      const totalIncome  = byCategory.filter(c => c.type === 'income').reduce((s, c) => s + c.total, 0)
      const totalExpense = byCategory.filter(c => c.type === 'expense').reduce((s, c) => s + c.total, 0)

      return {
        month,
        totalIncome:  Math.round(totalIncome  * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        balance:      Math.round((totalIncome - totalExpense) * 100) / 100,
        byCategory,
      }
    })

  const latestMonth = months.at(-1)?.month ?? new Date().toISOString().slice(0, 7)

  return { months, latestMonth }
}

/** Formats aggregated history as a compact markdown table for the prompt */
export function formatHistoryForPrompt(history: AggregatedHistory): string {
  if (history.months.length === 0) return 'No hay datos históricos disponibles.'

  const lines: string[] = []

  for (const m of history.months) {
    lines.push(`\n### ${m.month}`)
    lines.push(`- Ingresos totales: ${m.totalIncome} EUR`)
    lines.push(`- Gastos totales: ${m.totalExpense} EUR`)
    lines.push(`- Balance: ${m.balance} EUR`)
    lines.push('- Desglose de gastos:')
    for (const c of m.byCategory.filter(c => c.type === 'expense').sort((a, b) => b.total - a.total)) {
      lines.push(`  - ${c.name}: ${c.total} EUR (${c.count} transacciones)`)
    }
    lines.push('- Desglose de ingresos:')
    for (const c of m.byCategory.filter(c => c.type === 'income').sort((a, b) => b.total - a.total)) {
      lines.push(`  - ${c.name}: ${c.total} EUR (${c.count} transacciones)`)
    }
  }

  return lines.join('\n')
}
