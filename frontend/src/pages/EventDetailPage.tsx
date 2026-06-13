import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api, type Transaction } from '@/lib/api'
import { Icon } from '@/components/ui/Icon'
import { tripDays, fmtDate, isWithinRange } from '@/lib/dates'
import { Stagger, StaggerItem, AnimatedNumber } from '@/components/ui/Motion'
import styles from './EventDetailPage.module.css'

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

const FALLBACK_COLOR = '#94a3b8'

// ── FASE 4 · Desglose por categoría (memoizado) ───────────────

interface Slice { name: string; value: number; color: string }

function buildBreakdown(txs: Transaction[]): Slice[] {
  const map = new Map<string, Slice>()
  for (const t of txs) {
    if (t.type !== 'expense') continue
    const key   = t.category?.id ?? 'none'
    const name  = t.category?.name ?? 'Sin categoría'
    const color = t.category?.color ?? FALLBACK_COLOR
    const cur   = map.get(key) ?? { name, color, value: 0 }
    cur.value += t.amount
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}

// ── FASE 3 · Modal: vincular movimientos existentes ───────────

function LinkModal({ eventId, startDate, endDate, onClose }: {
  eventId: string; startDate: string; endDate: string | null; onClose: () => void
}) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState('')

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['linkable-transactions'],
    queryFn: () => api.events.linkable(),
  })

  // Sugerencia automática: los que caen dentro del rango del viaje van primero.
  // Además, filtro por texto (descripción o categoría) para listas largas.
  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = (t: Transaction) =>
      !q || t.description?.toLowerCase().includes(q) || t.category?.name?.toLowerCase().includes(q)
    return candidates
      .filter(matches)
      .sort((a, b) => {
        const ra = isWithinRange(a.date, startDate, endDate) ? 0 : 1
        const rb = isWithinRange(b.date, startDate, endDate) ? 0 : 1
        return ra - rb || b.date.localeCompare(a.date)
      })
  }, [candidates, startDate, endDate, search])

  const mutation = useMutation({
    mutationFn: () => api.events.link(eventId, [...selected]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-transactions', eventId] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['linkable-transactions'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className={`${styles.overlay} overlayIn`} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalWide} modalIn`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Vincular movimientos</h2>
          <button className={styles.iconBtn} onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <p className={styles.modalHint}>
          Los movimientos dentro de las fechas del viaje aparecen <strong>sugeridos</strong> arriba.
        </p>

        <div className={styles.searchWrap}>
          <Icon name="search" size={14} color="var(--color-text-muted)" />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Buscar por descripción o categoría..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.linkList}>
          {isLoading && <div className={styles.empty}><span>Cargando movimientos...</span></div>}
          {!isLoading && sorted.length === 0 && (
            <div className={styles.empty}><span>{search ? 'Sin resultados para esa búsqueda' : 'No hay gastos sin asignar para vincular'}</span></div>
          )}
          {sorted.map((t) => {
            const suggested = isWithinRange(t.date, startDate, endDate)
            return (
              <label key={t.id} className={`${styles.linkRow} ${selected.has(t.id) ? styles.linkRowActive : ''}`}>
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                <span className={styles.linkDate}>{fmtDate(t.date)}</span>
                <span className={styles.linkDesc}>
                  {t.description || <em className={styles.muted}>Sin descripción</em>}
                  {t.category && <span className={styles.linkCat} style={{ '--cat-color': t.category.color ?? FALLBACK_COLOR } as React.CSSProperties}>{t.category.name}</span>}
                </span>
                {suggested && <span className={styles.suggestedBadge}>Sugerido</span>}
                <span className={styles.linkAmount}>{fmt(t.amount)}</span>
              </label>
            )
          })}
        </div>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.modalActions}>
          <span className={styles.selectedCount}>{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          <button className={styles.submitBtn} disabled={selected.size === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Vinculando...' : 'Vincular seleccionados'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página de detalle ─────────────────────────────────────────

export function EventDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [linkOpen, setLinkOpen] = useState(false)

  const { data: event, isLoading: loadingEvent } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.events.get(id),
    enabled: !!id,
  })

  const { data: txs = [], isLoading: loadingTxs } = useQuery({
    queryKey: ['event-transactions', id],
    queryFn: () => api.events.transactions(id),
    enabled: !!id,
  })

  const unlinkMutation = useMutation({
    mutationFn: (txId: string) => api.events.unlink(txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-transactions', id] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['linkable-transactions'] })
    },
  })

  // ── FASE 4 · Cálculos client-side ──
  const breakdown = useMemo(() => buildBreakdown(txs), [txs])
  const totalSpent = useMemo(() => txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [txs])
  const days   = event ? tripDays(event.startDate, event.endDate) : 1
  const perDay = totalSpent / days

  if (loadingEvent) return <div className={styles.page}><div className={styles.empty}><span>Cargando viaje...</span></div></div>
  if (!event)       return <div className={styles.page}><div className={styles.empty}><span>Viaje no encontrado</span></div></div>

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/events')}>
        <Icon name="arrow-right" size={14} className={styles.backIcon} /> Volver a viajes
      </button>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{event.name}</h1>
          <p className={styles.pageSubtitle}>
            {event.destination ? `${event.destination} · ` : ''}
            {fmtDate(event.startDate)}{event.endDate ? ` → ${fmtDate(event.endDate)}` : ''} · {days} día{days !== 1 ? 's' : ''}
          </p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setLinkOpen(true)}>
          <Icon name="plus" size={15} /> Vincular movimientos
        </button>
      </div>

      {/* ── FASE 4 · Panel de estadísticas ── */}
      <Stagger className={styles.statsRow}>
        <StaggerItem className={`${styles.statCard} glow-hover`}>
          <span className={styles.statLabel}>Gasto total</span>
          <span className={styles.statValueBig}><AnimatedNumber value={totalSpent} format={(n) => fmt(n)} /></span>
        </StaggerItem>
        <StaggerItem className={`${styles.statCard} glow-hover`}>
          <span className={styles.statLabel}>Gasto medio / día</span>
          <span className={styles.statValueBig}><AnimatedNumber value={perDay} format={(n) => fmt(n)} /></span>
        </StaggerItem>
        <StaggerItem className={`${styles.statCard} glow-hover`}>
          <span className={styles.statLabel}>Movimientos</span>
          <span className={styles.statValueBig}><AnimatedNumber value={txs.length} format={(n) => String(Math.round(n))} /></span>
        </StaggerItem>
      </Stagger>

      <div className={styles.detailGrid}>
        {/* Gráfico circular por categoría */}
        <div className={styles.chartCard}>
          <h2 className={styles.cardTitle}>Gasto por categoría</h2>
          {breakdown.length === 0 ? (
            <div className={styles.empty}><span>Aún no hay gastos vinculados</span></div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100} paddingAngle={2} strokeWidth={0}>
                  {breakdown.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Lista de movimientos vinculados */}
        <div className={styles.listCard}>
          <h2 className={styles.cardTitle}>Movimientos vinculados</h2>
          {loadingTxs && <div className={styles.empty}><span>Cargando...</span></div>}
          {!loadingTxs && txs.length === 0 && (
            <div className={styles.empty}><span>Vincula tus primeros movimientos a este viaje</span></div>
          )}
          <div className={styles.txList}>
            {txs.map((t) => (
              <div key={t.id} className={styles.txRow}>
                <span className={styles.txDate}>{fmtDate(t.date)}</span>
                <span className={styles.txDesc}>
                  {t.description || <em className={styles.muted}>Sin descripción</em>}
                  {t.category && <span className={styles.txCat} style={{ '--cat-color': t.category.color ?? FALLBACK_COLOR } as React.CSSProperties}>{t.category.name}</span>}
                </span>
                <span className={styles.txAmount}>{fmt(t.amount)}</span>
                <button className={styles.iconBtn} title="Desvincular"
                  onClick={() => unlinkMutation.mutate(t.id)} disabled={unlinkMutation.isPending}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {linkOpen && (
        <LinkModal eventId={event.id} startDate={event.startDate} endDate={event.endDate} onClose={() => setLinkOpen(false)} />
      )}
    </div>
  )
}
