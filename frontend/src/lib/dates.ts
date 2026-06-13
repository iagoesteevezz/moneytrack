/**
 * Utilidades de fechas compartidas.
 * Todas las fechas de dominio se manejan como strings ISO `YYYY-MM-DD`
 * (coherente con el tipo `date` de Postgres y con los inputs <input type="date">).
 */

const MS_PER_DAY = 86_400_000

/** Fecha de hoy en formato `YYYY-MM-DD` (zona horaria local). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Días que abarca un viaje, ambos extremos inclusive.
 * Si no hay fecha de fin (viaje en curso), cuenta hasta hoy.
 * Mínimo 1 para evitar divisiones por cero en medias.
 */
export function tripDays(start: string, end: string | null): number {
  const a = new Date(start).getTime()
  const b = new Date(end ?? todayISO()).getTime()
  return Math.max(1, Math.round((b - a) / MS_PER_DAY) + 1)
}

/** ¿La fecha `date` cae dentro del rango [start, end]? (end null = abierto). */
export function isWithinRange(date: string, start: string, end: string | null): boolean {
  return date >= start && date <= (end ?? '9999-12-31')
}

/** Formatea una fecha ISO como "13 jun 2026". */
export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Formatea un rango. Sin fin → "Desde 13 jun 2026". */
export function fmtDateRange(start: string, end: string | null): string {
  const s = fmtDate(start)
  return end ? `${s} → ${fmtDate(end)}` : `Desde ${s}`
}
