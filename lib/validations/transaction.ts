import { z } from 'zod'

export const createTransactionSchema = z.object({
  categoryId: z.string().uuid().optional(),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be greater than 0').multipleOf(0.01),
  description: z.string().max(255).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
})

export const updateTransactionSchema = createTransactionSchema.partial().extend({
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().max(255).nullable().optional(),
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
