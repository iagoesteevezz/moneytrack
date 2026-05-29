import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI, Type } from '@google/genai'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import { aggregateHistory, formatHistoryForPrompt } from '../../lib/ai/aggregator'
import { getCachedAI, setCachedAI } from '../../lib/ai/cache'

// ── Types ─────────────────────────────────────────────────────

export interface Insight {
  type: 'anomaly' | 'trend' | 'suggestion' | 'positive'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  category: string
  amount: number
}

export interface InsightsResponse {
  insights: Insight[]
  summary: string
  generatedAt: string
  monthsAnalyzed: number
}

// ── Gemini schema ─────────────────────────────────────────────

const insightsSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    insights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type:        { type: Type.STRING },
          title:       { type: Type.STRING },
          description: { type: Type.STRING },
          impact:      { type: Type.STRING },
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

  // ── Cache lookup (bypass with ?force=1) ───────────────────────
  const force = req.query.force === '1'
  if (!force) {
    const cached = await getCachedAI<InsightsResponse>(ctx.supabase, ctx.userId, 'insights')
    if (cached) {
      console.log('[insights] serving from cache')
      res.status(200).json({ data: cached, error: null, cached: true })
      return
    }
  }

  // Guard: API key must exist
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  console.log('[gemini] apiKey present:', !!apiKey)
  if (!apiKey) {
    console.error('❌ ERROR CRÍTICO: No se encuentra GEMINI_API_KEY en las variables de entorno.')
    res.status(500).json({ data: null, error: { message: 'GEMINI_API_KEY not configured' } })
    return
  }

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const from = threeMonthsAgo.toISOString().slice(0, 10)

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

  if (txResult.error) {
    res.status(500).json({ data: null, error: { message: txResult.error.message } })
    return
  }

  const rows = (txResult.data as any[]).map(r => ({
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

  const budgetLines = budgetResult.data && (budgetResult.data as any[]).length > 0
    ? '\n## Presupuestos mensuales\n' +
      (budgetResult.data as any[]).map((b: any) =>
        `- ${b.category?.name ?? 'Sin nombre'}: límite ${Number(b.amount)} EUR/mes`
      ).join('\n')
    : ''

  const history = aggregateHistory(rows)
  const formattedHistory = formatHistoryForPrompt(history)

  const prompt = `Eres un asesor financiero personal experto. Analiza los datos financieros del usuario y genera entre 4 y 6 insights accionables.

## Datos históricos (últimos ${history.months.length} meses)
${formattedHistory}${budgetLines}

## Tipos de insight
- "anomaly": gasto inusualmente alto respecto a la media
- "trend": patrón sostenido durante 2+ meses
- "suggestion": acción concreta que el usuario puede tomar
- "positive": logro financiero destacable

Sé específico con cantidades en EUR. Usa "category" con el nombre exacto si aplica (o string vacío). Usa "amount" con el importe en EUR (o 0 si no aplica).`

  try {
    const ai = new GoogleGenAI({ apiKey })
    console.log('[gemini] SDK initialized, calling generateContent...')

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: insightsSchema,
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    })

    const text = response.text ?? '{}'
    const parsed = JSON.parse(text) as { summary: string; insights: Insight[] }

    // Normalize type/impact values defensively
    const validTypes   = new Set(['anomaly', 'trend', 'suggestion', 'positive'])
    const validImpacts = new Set(['high', 'medium', 'low'])

    const insights: Insight[] = (parsed.insights ?? []).map((ins: any) => ({
      type:        validTypes.has(ins.type)   ? ins.type   : 'suggestion',
      title:       String(ins.title       ?? ''),
      description: String(ins.description ?? ''),
      impact:      validImpacts.has(ins.impact) ? ins.impact : 'medium',
      category:    String(ins.category ?? ''),
      amount:      Number(ins.amount   ?? 0),
    }))

    const responseData: InsightsResponse = {
      insights,
      summary: String(parsed.summary ?? ''),
      generatedAt: new Date().toISOString(),
      monthsAnalyzed: history.months.length,
    }

    await setCachedAI(ctx.supabase, ctx.userId, 'insights', responseData)

    res.status(200).json({ data: responseData, error: null, cached: false })
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('❌ Error en la llamada a Gemini:', err)
    console.error('[ai/insights] Gemini error:', message)
    res.status(500).json({ data: null, error: { message: `AI error: ${message}` } })
  }
}
