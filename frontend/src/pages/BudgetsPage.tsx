import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type BudgetWithProgress, type Category } from '@/lib/api'
import { Icon } from '@/components/ui/Icon'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import styles from './BudgetsPage.module.css'

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function currentMonth() { return new Date().toISOString().slice(0, 7) }

function formatMonth(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })
}

// ── Progress bar ──────────────────────────────────────────────

function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className={styles.progressTrack}>
      <div className={styles.progressFill} style={{ width: `${Math.min(percentage, 100)}%`, background: color }} />
    </div>
  )
}

function statusColor(pct: number) {
  if (pct >= 100) return 'var(--color-expense)'
  if (pct >= 80)  return 'var(--color-warning)'
  return 'var(--color-income)'
}

// ── Budget card ───────────────────────────────────────────────

function BudgetCard({
  budget, onEdit, onDelete,
}: {
  budget: BudgetWithProgress
  onEdit: (b: BudgetWithProgress) => void
  onDelete: (id: string) => void
}) {
  const pct   = budget.percentage
  const color = statusColor(pct)
  const isOver    = pct >= 100
  const isWarning = pct >= 80 && !isOver

  return (
    <div className={`${styles.card} glow-hover`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardLeft}>
          <div className={styles.cardIconWrap} style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
            <Icon name="target" size={16} color={color} />
          </div>
          <div>
            <span className={styles.cardName}>{budget.categoryName}</span>
            {isOver    && <span className={`${styles.badge} ${styles.badgeOver}`}>Superado</span>}
            {isWarning && <span className={`${styles.badge} ${styles.badgeWarning}`}>Atención</span>}
          </div>
        </div>
        <div className={styles.cardActions}>
          <button className={styles.iconBtn} onClick={() => onEdit(budget)} title="Editar">
            <Icon name="edit" size={14} />
          </button>
          <button className={styles.iconBtn} onClick={() => onDelete(budget.id)} title="Eliminar">
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>

      <div className={styles.progressWrap}>
        <ProgressBar percentage={pct} color={color} />
        <span className={styles.progressPct} style={{ color }}>{pct.toFixed(0)}%</span>
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.cardStat}>
          <span className={styles.statLabel}>Gastado</span>
          <span className={styles.statValue} style={{ color: isOver ? 'var(--color-expense)' : 'var(--color-text-primary)' }}>
            {fmt(budget.spent)}
          </span>
        </div>
        <div className={styles.cardDivider} />
        <div className={styles.cardStat}>
          <span className={styles.statLabel}>Límite</span>
          <span className={styles.statValue}>{fmt(budget.amount)}</span>
        </div>
        <div className={styles.cardDivider} />
        <div className={styles.cardStat}>
          <span className={styles.statLabel}>{isOver ? 'Exceso' : 'Restante'}</span>
          <span className={styles.statValue} style={{ color }}>
            {fmt(Math.abs(budget.remaining))}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Budget modal ──────────────────────────────────────────────

function BudgetModal({
  budget, categories, onClose,
}: {
  budget: BudgetWithProgress | null
  categories: Category[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEditing = budget !== null

  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? '')
  const [amount, setAmount]         = useState(budget ? String(budget.amount) : '')
  const [error, setError]           = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.budgets.upsert({ categoryId, amount: Number(amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets'] }); onClose() },
    onError: (e: Error) => setError(e.message),
  })

  const expenseCategories = categories.filter(c => c.type === 'expense' || c.type === 'both')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId) { setError('Selecciona una categoría'); return }
    if (Number(amount) <= 0) { setError('El importe debe ser mayor que 0'); return }
    setError(null)
    mutation.mutate()
  }

  return (
    <div className={`${styles.overlay} overlayIn`} onClick={onClose}>
      <div className={`${styles.modal} modalIn`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEditing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
          <button className={styles.iconBtn} onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Categoría
            <select className={styles.input} value={categoryId} onChange={e => setCategoryId(e.target.value)} disabled={isEditing}>
              <option value="">Selecciona una categoría</option>
              {expenseCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Límite mensual (€)
            <input
              className={styles.input}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0,00"
              required
            />
          </label>

          {error && <p className={styles.formError}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear presupuesto'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export function BudgetsPage() {
  const qc = useQueryClient()
  const [month, setMonth]         = useState(currentMonth())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<BudgetWithProgress | null>(null)

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', month],
    queryFn: () => api.budgets.list(month),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories.list(),
    staleTime: Infinity,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.budgets.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent  = budgets.reduce((s, b) => s + b.spent, 0)
  const overCount   = budgets.filter(b => b.percentage >= 100).length
  const overallPct  = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  function openNew()                       { setEditing(null); setModalOpen(true) }
  function openEdit(b: BudgetWithProgress) { setEditing(b);    setModalOpen(true) }
  function closeModal()                    { setEditing(null); setModalOpen(false) }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Presupuestos</h1>
          <p className={styles.pageSubtitle}>{formatMonth(month)}</p>
        </div>
        <div className={styles.headerRight}>
          <input className={styles.monthInput} type="month" value={month} max={currentMonth()} onChange={e => setMonth(e.target.value)} />
          <button className={styles.primaryBtn} onClick={openNew}>
            <Icon name="plus" size={15} />
            Nuevo presupuesto
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      {budgets.length > 0 && (
        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Presupuesto total</span>
            <span className={styles.summaryValue}>{fmt(totalBudget)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Gasto total</span>
            <span className={styles.summaryValue} style={{ color: totalSpent > totalBudget ? 'var(--color-expense)' : 'var(--color-text-primary)' }}>
              {fmt(totalSpent)}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Uso global</span>
            <span className={styles.summaryValue} style={{ color: statusColor(overallPct) }}>
              {overallPct.toFixed(1)}%
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Categorías superadas</span>
            <span className={styles.summaryValue} style={{ color: overCount > 0 ? 'var(--color-expense)' : 'var(--color-income)' }}>
              {overCount} / {budgets.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {isLoading && (
        <div className={styles.empty}><span>Cargando presupuestos...</span></div>
      )}

      {!isLoading && budgets.length === 0 && (
        <div className={styles.empty}>
          <Icon name="target" size={32} color="var(--color-text-disabled)" />
          <span>Aún no tienes presupuestos para este mes</span>
          <button className={styles.primaryBtn} onClick={openNew}>
            <Icon name="plus" size={14} /> Crear el primero
          </button>
        </div>
      )}

      <Stagger className={styles.grid}>
        {budgets.map(b => (
          <StaggerItem key={b.id}>
            <BudgetCard
              budget={b}
              onEdit={openEdit}
              onDelete={id => deleteMutation.mutate(id)}
            />
          </StaggerItem>
        ))}
      </Stagger>

      {modalOpen && (
        <BudgetModal budget={editing} categories={categories} onClose={closeModal} />
      )}
    </div>
  )
}
