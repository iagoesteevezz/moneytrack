/**
 * Typed API client — wraps fetch with auth headers and error handling.
 * All functions throw on network/API errors so React Query can catch them.
 *
 * Strategy:
 *  - AI endpoints → backend (/api/ai/*) to hide the Gemini API key
 *  - Everything else → Supabase client directly (RLS enforces ownership)
 */
import { supabase } from './supabase'
import { eventSchema, linkTransactionsSchema, type EventInput } from './validations/event'

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
export type Priority = 'alta' | 'media' | 'baja'

export interface ShoppingItem {
  id: string
  userId: string
  item: string
  priority: Priority
  category: string | null
  isPurchased: boolean
  estimatedPrice: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

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
  eventId: string | null
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

// ── Budget types ──────────────────────────────────────────────

export interface BudgetWithProgress {
  id: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  categoryColor: string | null
  amount: number
  spent: number
  remaining: number
  percentage: number
  period: 'monthly'
  createdAt: string
  updatedAt: string
}

// ── Event types ───────────────────────────────────────────────

export interface Event {
  id: string
  userId: string
  name: string
  destination: string | null
  startDate: string          // YYYY-MM-DD
  endDate: string | null     // YYYY-MM-DD | null (viaje en curso)
  createdAt: string
  updatedAt: string
}

/** Evento enriquecido con métricas calculadas en cliente (para las tarjetas). */
export interface EventWithStats extends Event {
  totalSpent: number
  transactionCount: number
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

    create: (body: {
      type: TransactionType
      amount: number
      categoryId?: string
      description?: string
      date?: string
    }) => request<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(body) }),

    /** Direct Supabase — no backend hop needed, RLS enforces ownership */
    update: async (
      id: string,
      body: Partial<{
        type: TransactionType
        amount: number
        categoryId: string | null
        description: string | null
        date: string
      }>,
    ): Promise<Transaction> => {
      const updates: Record<string, unknown> = {}
      if (body.type        !== undefined) updates['type']        = body.type
      if (body.amount      !== undefined) updates['amount']      = body.amount
      if (body.categoryId  !== undefined) updates['category_id'] = body.categoryId
      if (body.description !== undefined) updates['description'] = body.description
      if (body.date        !== undefined) updates['date']        = body.date

      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select('*, category:categories(id, name, icon, color)')
        .single()

      if (error) throw new Error(error.message)
      return mapDbTransaction(data)
    },

    /** Direct Supabase — no backend hop needed, RLS enforces ownership */
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
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

  budgets: {
    list: (month?: string) => {
      const qs = month ? `?month=${month}` : ''
      return request<BudgetWithProgress[]>(`/api/budgets${qs}`)
    },
    upsert: (body: { categoryId: string; amount: number }) =>
      request<BudgetWithProgress>('/api/budgets', { method: 'POST', body: JSON.stringify(body) }),
    delete: async (id: string) => fetch(`/api/budgets?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: await getAuthHeader() },
    }).then(r => { if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`) }),
  },

  ai: {
    insights: () => request<InsightsResponse>('/api/ai/insights'),
    predict:  () => request<PredictResponse>('/api/ai/predict'),
  },

  // ── Events / Viajes ─────────────────────────────────────────
  // Acceso directo a Supabase: RLS garantiza la propiedad. Zod sanea
  // la entrada en el cliente antes de cada mutación.
  events: {
    /** Lista de viajes con gasto total y nº de movimientos (2 queries, agregado en cliente). */
    listWithStats: async (): Promise<EventWithStats[]> => {
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false })
      if (error) throw new Error(error.message)

      const ids = (events ?? []).map((e: any) => e.id)
      if (ids.length === 0) return []

      const { data: txs, error: txErr } = await supabase
        .from('transactions')
        .select('amount, event_id, type')
        .in('event_id', ids)
        .eq('type', 'expense')
      if (txErr) throw new Error(txErr.message)

      const agg = new Map<string, { total: number; count: number }>()
      for (const t of (txs ?? []) as { amount: number; event_id: string }[]) {
        const cur = agg.get(t.event_id) ?? { total: 0, count: 0 }
        cur.total += Number(t.amount)
        cur.count += 1
        agg.set(t.event_id, cur)
      }

      return (events as any[]).map((e) => ({
        ...mapDbEvent(e),
        totalSpent:       agg.get(e.id)?.total ?? 0,
        transactionCount: agg.get(e.id)?.count ?? 0,
      }))
    },

    get: async (id: string): Promise<Event> => {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single()
      if (error) throw new Error(error.message)
      return mapDbEvent(data)
    },

    create: async (input: EventInput): Promise<Event> => {
      const v = eventSchema.parse(input)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No active session')

      const { data, error } = await supabase
        .from('events')
        .insert({
          user_id:     user.id,                 // RLS WITH CHECK exige que coincida con auth.uid()
          name:        v.name,
          destination: v.destination ?? null,
          start_date:  v.startDate,
          end_date:    v.endDate ?? null,
        })
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return mapDbEvent(data)
    },

    update: async (id: string, input: EventInput): Promise<Event> => {
      const v = eventSchema.parse(input)
      const { data, error } = await supabase
        .from('events')
        .update({
          name:        v.name,
          destination: v.destination ?? null,
          start_date:  v.startDate,
          end_date:    v.endDate ?? null,
        })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return mapDbEvent(data)
    },

    /** Borra el viaje. Por el FK ON DELETE SET NULL, los movimientos se conservan desagrupados. */
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },

    /** Movimientos ya vinculados a un viaje. */
    transactions: async (eventId: string): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(id, name, icon, color)')
        .eq('event_id', eventId)
        .order('date', { ascending: false })
      if (error) throw new Error(error.message)
      return (data as any[]).map(mapDbTransaction)
    },

    /**
     * Candidatos a vincular: movimientos del usuario sin viaje asignado.
     * El modal los ordena para "sugerir" los que caen dentro del rango de fechas.
     */
    linkable: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(id, name, icon, color)')
        .is('event_id', null)
        .eq('type', 'expense')
        .order('date', { ascending: false })
        .limit(300)
      if (error) throw new Error(error.message)
      return (data as any[]).map(mapDbTransaction)
    },

    /** Vincula movimientos existentes al viaje (set event_id). */
    link: async (eventId: string, transactionIds: string[]): Promise<void> => {
      const { transactionIds: ids } = linkTransactionsSchema.parse({ transactionIds })
      const { error } = await supabase
        .from('transactions')
        .update({ event_id: eventId })
        .in('id', ids)
      if (error) throw new Error(error.message)
    },

    /** Desvincula un movimiento del viaje (event_id → null). */
    unlink: async (transactionId: string): Promise<void> => {
      const { error } = await supabase
        .from('transactions')
        .update({ event_id: null })
        .eq('id', transactionId)
      if (error) throw new Error(error.message)
    },
  },

  // ── Lista de la compra ──────────────────────────────────────
  shoppingList: {
    list: async (): Promise<ShoppingItem[]> => {
      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .order('is_purchased', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data as any[]).map(mapDbShoppingItem)
    },

    create: async (body: {
      item: string
      priority?: Priority
      category?: string
      estimatedPrice?: number | null
      notes?: string | null
    }): Promise<ShoppingItem> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')
      const { data, error } = await supabase
        .from('shopping_list')
        .insert({
          user_id:         session.user.id,
          item:            body.item,
          priority:        body.priority ?? 'media',
          category:        body.category ?? null,
          estimated_price: body.estimatedPrice ?? null,
          notes:           body.notes ?? null,
        })
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return mapDbShoppingItem(data)
    },

    update: async (
      id: string,
      body: Partial<{
        item: string
        priority: Priority
        category: string | null
        isPurchased: boolean
        estimatedPrice: number | null
        notes: string | null
      }>
    ): Promise<ShoppingItem> => {
      const updates: Record<string, unknown> = {}
      if (body.item            !== undefined) updates['item']            = body.item
      if (body.priority        !== undefined) updates['priority']        = body.priority
      if (body.category        !== undefined) updates['category']        = body.category
      if (body.isPurchased     !== undefined) updates['is_purchased']    = body.isPurchased
      if (body.estimatedPrice  !== undefined) updates['estimated_price'] = body.estimatedPrice
      if (body.notes           !== undefined) updates['notes']           = body.notes
      const { data, error } = await supabase
        .from('shopping_list')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return mapDbShoppingItem(data)
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('shopping_list').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
  },
}

// ── Internal mappers ──────────────────────────────────────────

function mapDbShoppingItem(row: any): ShoppingItem {
  return {
    id:             row.id,
    userId:         row.user_id,
    item:           row.item,
    priority:       row.priority as Priority,
    category:       row.category ?? null,
    isPurchased:    row.is_purchased,
    estimatedPrice: row.estimated_price != null ? Number(row.estimated_price) : null,
    notes:          row.notes ?? null,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  }
}

function mapDbTransaction(row: any): Transaction {
  return {
    id:          row.id,
    userId:      row.user_id,
    categoryId:  row.category_id ?? null,
    category:    row.category
      ? { id: row.category.id, name: row.category.name, icon: row.category.icon ?? null, color: row.category.color ?? null }
      : undefined,
    type:        row.type,
    amount:      Number(row.amount),
    description: row.description ?? null,
    date:        row.date,
    eventId:     row.event_id ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

function mapDbEvent(row: any): Event {
  return {
    id:          row.id,
    userId:      row.user_id,
    name:        row.name,
    destination: row.destination ?? null,
    startDate:   row.start_date,
    endDate:     row.end_date ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}
