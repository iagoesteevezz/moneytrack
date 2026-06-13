/**
 * FASE 2 · Validación / saneamiento estricto con Zod.
 *
 * Se ejecuta en el cliente, justo antes de cada mutación directa a
 * Supabase. RLS es la frontera de seguridad real (servidor); Zod
 * garantiza la *forma* y el *saneamiento* de la entrada (trim, rangos,
 * coherencia de fechas) y da feedback inmediato al usuario.
 */
import { z } from 'zod'

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD')

// ── Crear / editar Viaje ──────────────────────────────────────
export const eventSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'El nombre es obligatorio')
      .max(100, 'Máximo 100 caracteres'),
    destination: z
      .string()
      .trim()
      .max(100, 'Máximo 100 caracteres')
      .optional()
      // string vacío → undefined (no guardamos "" en BD)
      .transform((v) => (v ? v : undefined)),
    startDate: isoDate,
    endDate: isoDate.optional(),
  })
  // end_date nunca anterior a start_date (coherente con el CHECK de BD)
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['endDate'],
  })

// Edición parcial: revalidamos la coherencia de fechas solo si vienen ambas.
export const updateEventSchema = eventSchema

// ── Vincular movimientos existentes a un Viaje ────────────────
export const linkTransactionsSchema = z.object({
  transactionIds: z
    .array(z.string().uuid('ID de movimiento no válido'))
    .min(1, 'Selecciona al menos un movimiento'),
})

export type EventInput = z.infer<typeof eventSchema>
export type LinkTransactionsInput = z.infer<typeof linkTransactionsSchema>
