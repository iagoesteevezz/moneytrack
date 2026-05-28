import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Transaction, type TransactionType, type Category } from '@/lib/api'
import styles from './TransactionsPage.module.css'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Transaction Form Modal ────────────────────────────────────

interface FormState {
  type: TransactionType
  amount: string
  categoryId: string
  description: string
  date: string
}

const defaultForm = (): FormState => ({
  type: 'expense',
  amount: '',
  categoryId: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
})

function TransactionModal({
  transaction,
  categories,
  onClose,
}: {
  transaction: Transaction | null
  categories: Category[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEditing = transaction !== null

  const [form, setForm] = useState<FormState>(
    isEditing
      ? {
          type: transaction.type,
          amount: String(transaction.amount),
          categoryId: transaction.categoryId ?? '',
          description: transaction.description ?? '',
          date: new Date(transaction.date).toISOString().slice(0, 10),
        }
      : defaultForm()
  )

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        type: form.type,
        amount: Number(form.amount),
        categoryId: form.categoryId || undefined,
        description: form.description || undefined,
        date: form.date,
      }
      return isEditing
        ? api.transactions.update(transaction.id, payload)
        : api.transactions.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      onClose()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.transactions.delete(transaction!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      onClose()
    },
  })

  const filteredCategories = categories.filter(
    c => c.type === form.type || c.type === 'both'
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{isEditing ? 'Editar transacción' : 'Nueva transacción'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.typeToggle}>
            {(['expense', 'income'] as TransactionType[]).map(t => (
              <button
                key={t}
                type="button"
                className={`${styles.typeBtn} ${form.type === t ? styles.typeBtnActive : ''} ${t === 'income' ? styles.typeBtnIncome : styles.typeBtnExpense}`}
                onClick={() => setForm(f => ({ ...f, type: t, categoryId: '' }))}
              >
                {t === 'income' ? '↑ Ingreso' : '↓ Gasto'}
              </button>
            ))}
          </div>

          <label className={styles.label}>
            Importe (€)
            <input
              className={styles.input}
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={set('amount')}
              required
              placeholder="0,00"
            />
          </label>

          <label className={styles.label}>
            Categoría
            <select className={styles.input} value={form.categoryId} onChange={set('categoryId')}>
              <option value="">Sin categoría</option>
              {filteredCategories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Descripción
            <input
              className={styles.input}
              type="text"
              value={form.description}
              onChange={set('description')}
              placeholder="Opcional"
              maxLength={255}
            />
          </label>

          <label className={styles.label}>
            Fecha
            <input
              className={styles.input}
              type="date"
              value={form.date}
              onChange={set('date')}
              required
            />
          </label>

          {mutation.isError && (
            <p className={styles.error}>{(mutation.error as Error).message}</p>
          )}

          <div className={styles.modalActions}>
            {isEditing && (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            )}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Añadir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export function TransactionsPage() {
  const [filterType, setFilterType] = useState<TransactionType | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', filterType],
    queryFn: () => api.transactions.list(filterType ? { type: filterType } : {}),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories.list(),
    staleTime: Infinity,
  })

  function openNew() { setEditing(null); setModalOpen(true) }
  function openEdit(t: Transaction) { setEditing(t); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h2 className={styles.title}>Transacciones</h2>
        <div className={styles.controls}>
          <select
            className={styles.filterSelect}
            value={filterType}
            onChange={e => setFilterType(e.target.value as TransactionType | '')}
          >
            <option value="">Todas</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
          </select>
          <button className={styles.addBtn} onClick={openNew}>+ Nueva</button>
        </div>
      </div>

      {isLoading && <p className={styles.empty}>Cargando...</p>}
      {!isLoading && transactions.length === 0 && (
        <p className={styles.empty}>No hay transacciones. ¡Añade la primera!</p>
      )}

      <div className={styles.list}>
        {transactions.map(t => (
          <button key={t.id} className={styles.row} onClick={() => openEdit(t)}>
            <span className={styles.rowIcon}>
              {t.category?.icon ?? (t.type === 'income' ? '💰' : '💸')}
            </span>
            <div className={styles.rowInfo}>
              <span className={styles.rowName}>
                {t.description || t.category?.name || 'Sin descripción'}
              </span>
              <span className={styles.rowMeta}>
                {t.category?.name && t.description ? `${t.category.name} · ` : ''}
                {formatDate(t.date)}
              </span>
            </div>
            <span className={`${styles.rowAmount} ${t.type === 'income' ? styles.income : styles.expense}`}>
              {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
            </span>
          </button>
        ))}
      </div>

      {modalOpen && (
        <TransactionModal
          transaction={editing}
          categories={categories}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
