import { z } from 'zod'

// Mirrors the DB check constraints exactly so validation fails
// before the query is even built — never trust the client.

export const priorityEnum = z.enum(['alta', 'media', 'baja'])

export const createShoppingItemSchema = z.object({
  item: z
    .string()
    .trim()
    .min(1, 'El artículo no puede estar vacío')
    .max(255, 'Máximo 255 caracteres'),
  priority: priorityEnum.default('media'),
  category: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
  is_purchased: z.boolean().default(false),
  estimated_price: z
    .number()
    .positive('El precio debe ser mayor que 0')
    .multipleOf(0.01, 'Máximo 2 decimales')
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(1000, 'Máximo 1000 caracteres')
    .nullable()
    .optional(),
})

// PATCH: all fields optional, but if present must be valid
export const updateShoppingItemSchema = createShoppingItemSchema
  .partial()
  .extend({
    // Allow explicit null to clear these fields
    category:        z.string().trim().min(1).max(100).nullable().optional(),
    estimated_price: z.number().positive().multipleOf(0.01).nullable().optional(),
    notes:           z.string().max(1000).nullable().optional(),
  })

export type Priority              = z.infer<typeof priorityEnum>
export type CreateShoppingItemInput = z.infer<typeof createShoppingItemSchema>
export type UpdateShoppingItemInput = z.infer<typeof updateShoppingItemSchema>
