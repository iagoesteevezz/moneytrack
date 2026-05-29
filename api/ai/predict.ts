import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI, Type } from '@google/genai'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import { aggregateHistory, formatHistoryForPrompt } from '../../lib/ai/aggregator'

// ── Types ─────────────────────────────────────────────────────

export interface CategoryPrediction {
  category: string
  predictedAmount: number
  lastMonthAmount: number
  trend: 'up' | 'down' | 'stable'
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export interface PredictResponse {
  targetMonth: string
  predictedTotalExpense: number
  predictedTotalIncome: number
  predictedBalance: number
  categories: CategoryPrediction[]
  advice: string
  generatedAt: string
}

// ── Gemini schema ─────────────────────────────────────────────

const predictSchema = {
  type: Type.OBJECT,
  properties: {
    predictedTotalExpense: { type: Type.NUMBER },
    predictedTotalIncome:  { type: Type.NUMBER },
    predictedBalance:      { type: Type.NUMBER },
    advice:                { type: Type.STRING },
    categories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category:        { type: Type.STRING },
          predictedAmount: { type: Type.NUMBER },
          lastMonthAmount: { type: Type.NUMBER },
          trend:           { type: Type.STRING },
          confidence:      { type: Type.STRING },
          reasoning:       { type: Type.STRING },
        },
        required: ['category', 'predictedAmount', 'lastMonthAmount', 'trend', 'confidence', 'reasoning'],
      },
    },
  },
  required: ['predictedTotalExpense', 'predictedTotalIncome', 'predictedBalance', 'advice', 'categories'],
}

// ── Handler ───────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!allowMethods(req, res, ['GET'])) return

  const ctx = await requireAuth(req, res)
  if (!ctx) return

  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) {
    res.status(500).json({ data: null, error: { message: 'GEMINI_API_KEY not configured' } })
    return
  }

  const now = new Date()
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString().slice(0, 7)

  const fourMonthsAgo = new Date()
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)
  const from = fourMonthsAgo.toISOString().slice(0, 10)

  const { data, error } = await ctx.supabase
    .from('transactions')
    .select('type, amount, date, category:categories(name)')
    .gte('date', from)
    .order('date', { ascending: true })

  if (error) {
    res.status(500).json({ data: null, error: { message: error.message } })
    return
  }

  const rows = (data as any[]).map(r => ({
    type: r.type,
    amount: r.amount,
    date: r.date,
    category_name: r.category?.name ?? null,
  }))

  if (rows.length < 3) {
    res.status(200).json({
      data: {
        targetMonth,
        predictedTotalExpense: 0,
        predictedTotalIncome: 0,
        predictedBalance: 0,
        categories: [],
        advice: 'Necesitas más datos históricos para generar predicciones precisas. Registra al menos un mes completo.',
        generatedAt: new Date().toISOString(),
      } satisfies PredictResponse,
      error: null,
    })
    return
  }

  const history = aggregateHistory(rows)
  const formattedHistory = formatHistoryForPrompt(history)

  const prompt = `Eres un modelo de predicción financiera. Basándote EXCLUSIVAMENTE en el historial real del usuario, predice el mes ${targetMonth}.

## Historial financiero
${formattedHistory}

## Reglas
- Solo incluye en "categories" las categorías de GASTOS del historial
- "high" confidence: datos en 3+ meses. "medium": 2 meses. "low": 1 mes
- "stable" si variación intermensual < 10%
- Pondera más los meses recientes
- Todos los importes en EUR`

  try {
    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: predictSchema,
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    })

    const text = response.text ?? '{}'
    const parsed = JSON.parse(text) as Omit<PredictResponse, 'targetMonth' | 'generatedAt'>

    const validTrends      = new Set(['up', 'down', 'stable'])
    const validConfidences = new Set(['high', 'medium', 'low'])

    const categories: CategoryPrediction[] = (parsed.categories ?? []).map((c: any) => ({
      category:        String(c.category ?? ''),
      predictedAmount: Number(c.predictedAmount ?? 0),
      lastMonthAmount: Number(c.lastMonthAmount ?? 0),
      trend:           validTrends.has(c.trend)           ? c.trend      : 'stable',
      confidence:      validConfidences.has(c.confidence) ? c.confidence : 'medium',
      reasoning:       String(c.reasoning ?? ''),
    }))

    res.status(200).json({
      data: {
        targetMonth,
        predictedTotalExpense: Number(parsed.predictedTotalExpense ?? 0),
        predictedTotalIncome:  Number(parsed.predictedTotalIncome  ?? 0),
        predictedBalance:      Number(parsed.predictedBalance       ?? 0),
        advice:                String(parsed.advice ?? ''),
        categories,
        generatedAt: new Date().toISOString(),
      } satisfies PredictResponse,
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ai/predict] Gemini error:', message)
    res.status(500).json({ data: null, error: { message: `AI error: ${message}` } })
  }
}
