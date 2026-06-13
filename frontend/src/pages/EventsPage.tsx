import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api, type EventWithStats, type Event } from '@/lib/api'
import { eventSchema } from '@/lib/validations/event'
import { tripDays, fmtDateRange, todayISO } from '@/lib/dates'
import { Icon } from '@/components/ui/Icon'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import styles from './EventsPage.module.css'

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

// ── Tarjeta de viaje ──────────────────────────────────────────

function EventCard({ event, onOpen, onEdit, onDelete }: {
  event: EventWithStats
  onOpen: (id: string) => void
  onEdit: (e: EventWithStats) => void
  onDelete: (id: string) => void
}) {
  const perDay = event.totalSpent / tripDays(event.startDate, event.endDate)
  return (
    <div className={`${styles.card} glow-hover`} onClick={() => onOpen(event.id)}>
      <div className={styles.cardHeader}>
        <div className={styles.cardLeft}>
          <div className={styles.cardIconWrap}>
            <Icon name="calendar" size={16} color="var(--color-brand)" />
          </div>
          <div className={styles.cardTitleWrap}>
            <span className={styles.cardName}>{event.name}</span>
            {event.destination && <span className={styles.cardDest}>{event.destination}</span>}
          </div>
        </div>
        <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
          <button className={styles.iconBtn} onClick={() => onEdit(event)} title="Editar">
            <Icon name="edit" size={14} />
          </button>
          <button className={styles.iconBtn} onClick={() => onDelete(event.id)} title="Eliminar">
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>

      <div className={styles.cardDates}>
        <Icon name="calendar" size={12} color="var(--color-text-muted)" />
        {fmtDateRange(event.startDate, event.endDate)}
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.cardStat}>
          <span className={styles.statLabel}>Gasto total</span>
          <span className={styles.statValue}>{fmt(event.totalSpent)}</span>
        </div>
        <div className={styles.cardDivider} />
        <div className={styles.cardStat}>
          <span className={styles.statLabel}>Media / día</span>
          <span className={styles.statValue}>{fmt(perDay)}</span>
        </div>
        <div className={styles.cardDivider} />
        <div className={styles.cardStat}>
          <span className={styles.statLabel}>Movimientos</span>
          <span className={styles.statValue}>{event.transactionCount}</span>
        </div>
      </div>
    </div>
  )
}

// ── Comparativa entre viajes (objetivo del módulo) ────────────

function ComparisonChart({ events }: { events: EventWithStats[] }) {
  // Solo viajes con gasto, ordenados por coste total descendente.
  const data = useMemo(
    () =>
      events
        .filter((e) => e.totalSpent > 0)
        .map((e) => ({
          name: e.name,
          Total: Number(e.totalSpent.toFixed(2)),
          'Media/día': Number((e.totalSpent / tripDays(e.startDate, e.endDate)).toFixed(2)),
        }))
        .sort((a, b) => b.Total - a.Total),
    [events],
  )

  if (data.length < 2) return null

  return (
    <div className={styles.compareCard}>
      <h2 className={styles.compareTitle}>Comparativa de coste</h2>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 56)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} barGap={2}>
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
          <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: 'var(--color-surface-2)' }} />
          <Bar dataKey="Total" fill="var(--color-brand)" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Media/día" fill="var(--color-income)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className={styles.compareLegend}>
        <span><span className={styles.legendDot} style={{ background: 'var(--color-brand)' }} /> Gasto total</span>
        <span><span className={styles.legendDot} style={{ background: 'var(--color-income)' }} /> Gasto medio / día</span>
      </div>
    </div>
  )
}

// ── Modal crear / editar ──────────────────────────────────────

function EventModal({ event, onClose }: { event: Event | null; onClose: () => void }) {
  const qc = useQueryClient()
  const isEditing = event !== null

  const [name, setName]               = useState(event?.name ?? '')
  const [destination, setDestination] = useState(event?.destination ?? '')
  const [startDate, setStartDate]     = useState(event?.startDate ?? todayISO())
  const [endDate, setEndDate]         = useState(event?.endDate ?? '')
  const [error, setError]             = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, destination, startDate, endDate: endDate || undefined }
      return isEditing ? api.events.update(event.id, input) : api.events.create(input)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); onClose() },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Validación Zod en cliente → feedback inmediato antes de tocar Supabase.
    const parsed = eventSchema.safeParse({ name, destination, startDate, endDate: endDate || undefined })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Datos no válidos'); return }
    setError(null)
    mutation.mutate()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEditing ? 'Editar viaje' : 'Nuevo viaje'}</h2>
          <button className={styles.iconBtn} onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Nombre
            <input className={styles.input} type="text" value={name} maxLength={100}
              onChange={(e) => setName(e.target.value)} placeholder="Ej: Viaje a Lisboa" required />
          </label>

          <label className={styles.label}>
            Destino <span className={styles.optional}>(opcional)</span>
            <input className={styles.input} type="text" value={destination} maxLength={100}
              onChange={(e) => setDestination(e.target.value)} placeholder="Ej: Portugal" />
          </label>

          <div className={styles.formGrid}>
            <label className={styles.label}>
              Inicio
              <input className={styles.input} type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)} required />
            </label>
            <label className={styles.label}>
              Fin <span className={styles.optional}>(opcional)</span>
              <input className={styles.input} type="date" value={endDate} min={startDate}
                onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>

          {error && <p className={styles.formError}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear viaje'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export function EventsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<EventWithStats | null>(null)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.events.listWithStats(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.events.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })

  function openNew()  { setEditing(null); setModalOpen(true) }
  function closeModal() { setEditing(null); setModalOpen(false) }
  function handleDelete(id: string) {
    if (confirm('¿Eliminar este viaje? Los movimientos se conservarán, solo se desagruparán.')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Viajes y Eventos</h1>
          <p className={styles.pageSubtitle}>Agrupa tus gastos para comparar el coste de cada viaje</p>
        </div>
        <button className={styles.primaryBtn} onClick={openNew}>
          <Icon name="plus" size={15} /> Nuevo viaje
        </button>
      </div>

      {isLoading && <div className={styles.empty}><span>Cargando viajes...</span></div>}

      {!isLoading && events.length === 0 && (
        <div className={styles.empty}>
          <Icon name="calendar" size={32} color="var(--color-text-disabled)" />
          <span>Aún no tienes viajes registrados</span>
          <button className={styles.primaryBtn} onClick={openNew}>
            <Icon name="plus" size={14} /> Crear el primero
          </button>
        </div>
      )}

      {!isLoading && events.length >= 2 && <ComparisonChart events={events} />}

      <Stagger className={styles.grid}>
        {events.map((e) => (
          <StaggerItem key={e.id}>
            <EventCard
              event={e}
              onOpen={(id) => navigate(`/events/${id}`)}
              onEdit={(ev) => { setEditing(ev); setModalOpen(true) }}
              onDelete={handleDelete}
            />
          </StaggerItem>
        ))}
      </Stagger>

      {modalOpen && <EventModal event={editing} onClose={closeModal} />}
    </div>
  )
}
