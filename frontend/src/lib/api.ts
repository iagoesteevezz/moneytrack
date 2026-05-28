/**
 * Typed API client — wraps fetch with auth headers and error handling.
 * All functions throw on network/API errors so React Query can catch them.
 */
import { supabase } from './supabase'

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No active session')
  return `Bearer ${session.access_token}`
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const auth = await getAuthHeader()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
      ...options.headers,
    },
  })

  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status}`)
  }
  return json.data as T
}

// ── Types (shared with backend) ──────────────────────────────

export type TransactionType = 'income' | 'expense'
export type CategoryType = 'income' | 'expense' | 'both'

export interface Category {
  id: string
  userId: string | null
  name: string
  icon: string | null
  color: string | null
  type: CategoryType
  isSystemDefault: boolean
  createdAt: string
}

export interface Transaction {
  id: string
  userId: string
  categoryId: string | null
  category?: { id: string; name: string; icon: string | null; color: string | null }
  type: TransactionType
  amount: number
  description: string | null
  date: string
  createdAt: string
  updatedAt: string
}

export interface Profile {
  id: string
  email: string
  fullName: string | null
  currency: string
}

export interface MonthlySummary {
  month: string
  totalIncome: number
  totalExpense: number
  balance: number
}

export interface CategoryBreakdown {
  categoryId: string
  categoryName: string
  color: string | null
  icon: string | null
  total: number
  percentage: number
  count: number
}

export interface StatsSummary {
  period: { from: string; to: string }
  summary: MonthlySummary
  breakdown: { income: CategoryBreakdown[]; expense: CategoryBreakdown[] }
}

// ── AI types ─────────────────────────────────────────────────

export interface Insight {
  type: 'anomaly' | 'trend' | 'suggestion' | 'positive'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  category?: string
  amount?: number
}

export interface InsightsResponse {
  insights: Insight[]
  summary: string
  generatedAt: string
  monthsAnalyzed: number
}

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

export interface TransactionFilters {
  type?: TransactionType
  category_id?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

// ── API functions ─────────────────────────────────────────────

export const api = {
  auth: {
    me: () => request<Profile>('/api/auth/me'),
    updateProfile: (body: { fullName?: string; currency?: string }) =>
      request<Profile>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  },

  transactions: {
    list: (filters: TransactionFilters = {}) => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined) params.set(k, String(v))
      })
      const qs = params.size ? `?${params}` : ''
      return request<Transaction[]>(`/api/transactions${qs}`)
    },
    get: (id: string) => request<Transaction>(`/api/transactions/${id}`),
    create: (body: {
      type: TransactionType
      amount: number
      categoryId?: string
      description?: string
      date?: string
    }) => request<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<{
      type: TransactionType
      amount: number
      categoryId: string | null
      description: string | null
      date: string
    }>) => request<Transaction>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: async (id: string) => fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: await getAuthHeader() },
    }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`) }),
  },

  categories: {
    list: (type?: CategoryType) => {
      const qs = type ? `?type=${type}` : ''
      return request<Category[]>(`/api/categories${qs}`)
    },
    create: (body: { name: string; type: CategoryType; icon?: string; color?: string }) =>
      request<Category>('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
  },

  stats: {
    summary: (month?: string) => {
      const qs = month ? `?month=${month}` : ''
      return request<StatsSummary>(`/api/stats/summary${qs}`)
    },
  },

  ai: {
    insights: () => request<InsightsResponse>('/api/ai/insights'),
    predict:  () => request<PredictResponse>('/api/ai/predict'),
  },
}
