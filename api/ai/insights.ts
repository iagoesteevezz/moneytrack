import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI, Type } from '@google/genai'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import { aggregateHistory, formatHistoryForPrompt } from '../../lib/ai/aggregator'

const ai = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! })

// ── Response types ────────────────────────────────────────────

export interface Insight {
  type: 'anomaly' | 'trend' | 'suggestion' | 'positive'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  category: string    // empty string if not applicable
  amount: number      // 0 if not applicable
}

export interface InsightsResponse {
  insights: Insight[]
  summary: string
  generatedAt: string
  monthsAnalyzed: number
}

// ── Gemini response schema ────────────────────────────────────
// Gemini validates this server-side — no JSON.parse needed.

const insightsSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    insights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type:        { type: Type.STRING, enum: ['anomaly', 'trend', 'suggestion', 'positive'] },
          title:       { type: Type.STRING },
          description: { type: Type.STRING },
          impact:      { type: Type.STRING, enum: ['high', 'medium', 'low'] },
          category:    { type: Type.STRING },
          amount:      { type: Type.NUMBER },
        },
        required: ['type', 'title', 'description', 'impact', 'category', 'amount'],
      },
    },
  },
  required: ['summary', 'insights'],
}

// ── Handler ───────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET'])) return

  const ctx = await requireAuth(req, res)
  if (!ctx) return

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const from = threeMonthsAgo.toISOString().slice(0, 10)

  // Fetch transactions and current month budgets in parallel
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [txResult, budgetResult] = await Promise.all([
    ctx.supabase
      .from('transactions')
      .select('type, amount, date, category:categories(name)')
      .gte('date', from)
      .order('date', { ascending: true }),
    ctx.supabase
      .from('budgets')
      .select('amount, category:categories(name)')
      .eq('user_id', ctx.userId)
      .eq('period', 'monthly'),
  ])

  const { data, error } = txResult
  if (error) {
    res.status(500).json({ data: null, error: { message: error.message } })
    return
  }

  // Format budget context for the prompt
  const budgetLines = budgetResult.data && (budgetResult.data as any[]).length > 0
    ? '\n## Presupuestos mensuales configurados por el usuario\n' +
      (budgetResult.data as any[])
        .map((b: any) => `- ${b.category?.name ?? 'Sin nombre'}: límite ${Number(b.amount)} EUR/mes`)
        .join('\n')
    : ''

  const rows = (data as any[]).map(r => ({
    type: r.type,
    amount: r.amount,
    date: r.date,
    category_name: r.category?.name ?? null,
  }))

  if (rows.length < 5) {
    res.status(200).json({
      data: {
        insights: [],
        summary: 'Necesitas al menos algunas transacciones registradas para que la IA pueda generar insights útiles.',
        generatedAt: new Date().toISOString(),
        monthsAnalyzed: 0,
      } satisfies InsightsResponse,
      error: null,
    })
    return
  }

  const history = aggregateHistory(rows)
  const formattedHistory = formatHistoryForPrompt(history)

  const prompt = `Eres un asesor financiero personal experto. Analiza los siguientes datos de finanzas personales y genera entre 4 y 6 insights accionables.

## Datos históricos (últimos ${history.months.length} meses)
${formattedHistory}${budgetLines}

## Instrucciones
- Si el usuario tiene presupuestos configurados, prioriza insights sobre categorías que los superan o están cerca de hacerlo
- "anomaly": gasto inusualmente alto o bajo respecto a la media del historial
- "trend": patrón sostenido durante 2+ meses (creciente o decreciente)
- "suggestion": acción concreta y específica que el usuario puede tomar
- "positive": logro financiero que vale la pena destacar

Sé específico con cantidades en EUR. Usa el campo "category" con el nombre exacto de la categoría si el insight es sobre una categoría concreta (o string vacío si es general). Usa "amount" con el importe relevante en EUR (o 0 si no aplica). No inventes datos que no estén en el historial.`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: insightsSchema,
        temperature: 0.3,    // lower = more factual, less creative
        maxOutputTokens: 1024,
      },
    })

    // With responseSchema + responseMimeType, .text is guaranteed valid JSON
    const parsed = JSON.parse(response.text ?? '{}') as { summary: string; insights: Insight[] }

    res.status(200).json({
      data: {
        insights: parsed.insights,
        summary: parsed.summary,
        generatedAt: new Date().toISOString(),
        monthsAnalyzed: history.months.length,
      } satisfies InsightsResponse,
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error'
    res.status(500).json({ data: null, error: { message: `AI processing failed: ${message}` } })
  }
}
