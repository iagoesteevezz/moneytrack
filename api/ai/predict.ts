import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI, Type } from '@google/genai'
import { requireAuth, allowMethods } from '../../lib/supabase/auth'
import { aggregateHistory, formatHistoryForPrompt } from '../../lib/ai/aggregator'

const ai = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! })

// ── Response types ────────────────────────────────────────────

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

// ── Gemini response schema ────────────────────────────────────

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
          category:          { type: Type.STRING },
          predictedAmount:   { type: Type.NUMBER },
          lastMonthAmount:   { type: Type.NUMBER },
          trend:             { type: Type.STRING, enum: ['up', 'down', 'stable'] },
          confidence:        { type: Type.STRING, enum: ['high', 'medium', 'low'] },
          reasoning:         { type: Type.STRING },
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

## Reglas de predicción
- Solo incluye en "categories" las categorías de GASTOS que aparezcan en el historial
- "high" confidence: la categoría tiene datos en 3+ meses
- "medium" confidence: datos en 2 meses
- "low" confidence: solo 1 mes de datos
- "stable" si la variación intermensual es < 10%
- Pondera más los meses recientes (peso decreciente hacia atrás)
- "lastMonthAmount" debe ser el importe real del mes más reciente disponible para esa categoría
- Todos los importes en EUR
- No inventes categorías que no estén en el historial`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: predictSchema,
        temperature: 0.2,   // muy bajo — queremos números, no creatividad
        maxOutputTokens: 1024,
      },
    })

    const parsed = JSON.parse(response.text ?? '{}') as Omit<PredictResponse, 'targetMonth' | 'generatedAt'>

    res.status(200).json({
      data: {
        ...parsed,
        targetMonth,
        generatedAt: new Date().toISOString(),
      } satisfies PredictResponse,
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error'
    res.status(500).json({ data: null, error: { message: `AI processing failed: ${message}` } })
  }
}
