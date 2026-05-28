import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type BudgetWithProgress, type Category } from '@/lib/api'
import styles from './BudgetsPage.module.css'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function formatMonth(ym: string) {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1)
    .toLocaleString('es-ES', { month: 'long', year: 'numeric' })
}

// ── Progress bar ──────────────────────────────────────────────

function ProgressBar({ percentage }: { percentage: number }) {
  const capped = Math.min(percentage, 100)
  const color = percentage >= 100 ? '#dc2626'
              : percentage >= 80  ? '#f97316'
              : '#6366f1'
  return (
    <div className={styles.progressTrack}>
      <div
        className={styles.progressFill}
        style={{ width: `${capped}%`, background: color }}
      />
    </div>
  )
}

// ── Budget card ───────────────────────────────────────────────

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: BudgetWithProgress
  onEdit: (b: BudgetWithProgress) => void
  onDelete: (id: string) => void
}) {
  const isOver    = budget.percentage >= 100
  const isWarning = budget.percentage >= 80 && !isOver

  return (
    <div className={`${styles.card} ${isOver ? styles.cardOver : isWarning ? styles.cardWarning : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardLeft}>
          <span className={styles.cardIcon}>{budget.categoryIcon ?? '📦'}</span>
          <div>
            <span className={styles.cardName}>{budget.categoryName}</span>
            {isOver    && <span className={styles.badge} style={{ background: '#fee2e2', color: '#dc2626' }}>Superado</span>}
            {isWarning && <span className={styles.badge} style={{ background: '#fff7ed', color: '#f97316' }}>⚠ Atención</span>}
          </div>
        </div>
        <div className={styles.cardActions}>
          <button className={styles.actionBtn} onClick={() => onEdit(budget)} title="Editar">✏️</button>
          <button className={styles.actionBtn} onClick={() => onDelete(budget.id)} title="Eliminar">🗑️</button>
        </div>
      </div>

      <ProgressBar percentage={budget.percentage} />

      <div className={styles.cardFooter}>
        <span className={styles.spent}>
          Gastado: <strong>{formatCurrency(budget.spent)}</strong>
        </span>
        <span className={styles.limit}>
          Límite: {formatCurrency(budget.amount)}
        </span>
        <span className={`${styles.remaining} ${isOver ? styles.remainingOver : ''}`}>
          {isOver
            ? `${formatCurrency(Math.abs(budget.remaining))} de exceso`
            : `${formatCurrency(budget.remaining)} restante`}
        </span>
      </div>

      <div className={styles.pct}>
        {budget.percentage.toFixed(1)}% del presupuesto usado
      </div>
    </div>
  )
}

// ── Budget modal ──────────────────────────────────────────────

function BudgetModal({
  budget,
  categories,
  onClose,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['ai'] })   // insights may reference budgets
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  // Only show expense categories that don't already have a budget (when creating new)
  const expenseCategories = categories.filter(c => c.type === 'expense' || c.type === 'both')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId) { setError('Selecciona una categoría'); return }
    if (Number(amount) <= 0) { setError('El importe debe ser mayor que 0'); return }
    setError(null)
    mutation.mutate()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{isEditing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Categoría
            <select
              className={styles.input}
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              disabled={isEditing}
            >
              <option value="">Selecciona una categoría</option>
              {expenseCategories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
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

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear presupuesto'}
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

  function openNew()                          { setEditing(null);   setModalOpen(true) }
  function openEdit(b: BudgetWithProgress)    { setEditing(b);      setModalOpen(true) }
  function closeModal()                       { setEditing(null);   setModalOpen(false) }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.title}>Presupuestos</h2>
          <p className={styles.subtitle}>{formatMonth(month)}</p>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.monthPicker}
            type="month"
            value={month}
            max={currentMonth()}
            onChange={e => setMonth(e.target.value)}
          />
          <button className={styles.addBtn} onClick={openNew}>+ Nuevo</button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      {budgets.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Presupuesto total</span>
            <span className={styles.summaryValue}>{formatCurrency(totalBudget)}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Gasto total</span>
            <span className={`${styles.summaryValue} ${totalSpent > totalBudget ? styles.over : ''}`}>
              {formatCurrency(totalSpent)}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Categorías superadas</span>
            <span className={`${styles.summaryValue} ${overCount > 0 ? styles.over : styles.ok}`}>
              {overCount} / {budgets.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {isLoading && <p className={styles.empty}>Cargando...</p>}

      {!isLoading && budgets.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🎯</span>
          <p>Aún no tienes presupuestos para este mes.</p>
          <button className={styles.addBtn} onClick={openNew}>Crear el primero</button>
        </div>
      )}

      <div className={styles.grid}>
        {budgets.map(b => (
          <BudgetCard
            key={b.id}
            budget={b}
            onEdit={openEdit}
            onDelete={id => deleteMutation.mutate(id)}
          />
        ))}
      </div>

      {modalOpen && (
        <BudgetModal
          budget={editing}
          categories={categories}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
