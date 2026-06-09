// ============================================================
// Database types — derived from the Supabase schema
// Run `supabase gen types typescript` to regenerate after schema changes
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type TransactionType = 'income' | 'expense'
export type CategoryType = 'income' | 'expense' | 'both'
export type Priority = 'alta' | 'media' | 'baja'

// ── Raw DB rows ──────────────────────────────────────────────

export interface DbProfile {
  id: string
  email: string
  full_name: string | null
  currency: string
  created_at: string
  updated_at: string
}

export interface DbCategory {
  id: string
  user_id: string | null
  name: string
  icon: string | null
  color: string | null
  type: CategoryType
  system_default: boolean
  created_at: string
}

export interface DbTransaction {
  id: string
  user_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  description: string | null
  date: string           // ISO date string YYYY-MM-DD
  created_at: string
  updated_at: string
}

// ── Application-level types (camelCase, enriched) ────────────

export interface Category {
  id: string
  userId: string | null
  name: string
  icon: string | null
  color: string | null
  type: CategoryType
  isSystemDefault: boolean
  createdAt: Date
}

export interface Transaction {
  id: string
  userId: string
  categoryId: string | null
  category?: Pick<Category, 'id' | 'name' | 'icon' | 'color'>
  type: TransactionType
  amount: number
  description: string | null
  date: Date
  createdAt: Date
  updatedAt: Date
}

export interface Profile {
  id: string
  email: string
  fullName: string | null
  currency: string
  createdAt: Date
  updatedAt: Date
}

// ── API payloads ─────────────────────────────────────────────

export interface CreateTransactionPayload {
  categoryId?: string
  type: TransactionType
  amount: number
  description?: string
  date?: string   // YYYY-MM-DD, defaults to today
}

export interface UpdateTransactionPayload {
  categoryId?: string | null
  type?: TransactionType
  amount?: number
  description?: string | null
  date?: string
}

export interface CreateCategoryPayload {
  name: string
  icon?: string
  color?: string
  type: CategoryType
}

export interface UpdateProfilePayload {
  fullName?: string
  currency?: string
}

// ── API response wrappers ────────────────────────────────────

export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: {
    message: string
    code?: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ── Shopping List ────────────────────────────────────────────

export interface DbShoppingItem {
  id: string
  user_id: string
  item: string
  priority: Priority
  category: string | null
  is_purchased: boolean
  estimated_price: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

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

export interface CreateShoppingItemPayload {
  item: string
  priority?: Priority
  category?: string
  is_purchased?: boolean
  estimated_price?: number | null
  notes?: string | null
}

export type UpdateShoppingItemPayload = Partial<CreateShoppingItemPayload>

// ── Stats / dashboard types ──────────────────────────────────

export interface MonthlySummary {
  month: string        // YYYY-MM
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
