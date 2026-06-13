import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { api, type Transaction, type TransactionType, type Category } from '@/lib/api'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/context/AuthContext'
import styles from './TransactionsPage.module.css'

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function downloadCSV(filters: { type?: string; from?: string; to?: string }, token: string) {
  const params = new URLSearchParams()
  if (filters.type) params.set('type', filters.type)
  if (filters.from) params.set('from', filters.from)
  if (filters.to)   params.set('to', filters.to)
  const qs = params.size ? `?${params}` : ''
  const res = await fetch(`/api/export/csv${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'moneytrack_export.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Donut chart ───────────────────────────────────────────────

function DonutSummary({ income, expense }: { income: number; expense: number }) {
  const total = income + expense
  if (total === 0) return null
  const data = [
    { name: 'Ingresos', value: income,  color: 'var(--color-income)' },
    { name: 'Gastos',   value: expense, color: 'var(--color-expense)' },
  ]
  return (
    <div className={styles.donutWrap}>
      <ResponsiveContainer width={80} height={80}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={24} outerRadius={38} dataKey="value" strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className={styles.donutLegend}>
        {data.map(d => (
          <div key={d.name} className={styles.donutLegendItem}>
            <span className={styles.donutDot} style={{ background: d.color }} />
            <span>{d.name}</span>
            <span className={styles.donutPct}>{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────

interface FormState {
  type: TransactionType; amount: string; categoryId: string; description: string; date: string
}
const defaultForm = (): FormState => ({
  type: 'expense', amount: '', categoryId: '', description: '',
  date: new Date().toISOString().slice(0, 10),
})

function TransactionModal({ transaction, categories, onClose }: {
  transaction: Transaction | null; categories: Category[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const isEditing = transaction !== null
  const [form, setForm] = useState<FormState>(
    isEditing ? {
      type: transaction.type, amount: String(transaction.amount),
      categoryId: transaction.categoryId ?? '', description: transaction.description ?? '',
      date: typeof transaction.date === 'string' ? transaction.date.slice(0, 10) : new Date(transaction.date).toISOString().slice(0, 10),
    } : defaultForm()
  )
  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { type: form.type, amount: Number(form.amount), categoryId: form.categoryId || undefined, description: form.description || undefined, date: form.date }
      return isEditing ? api.transactions.update(transaction.id, payload) : api.transactions.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['stats'] }); onClose() },
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.transactions.delete(transaction!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['stats'] }); onClose() },
  })
  const filteredCats = categories.filter(c => c.type === form.type || c.type === 'both')

  return (
    <div className={`${styles.overlay} overlayIn`} onClick={onClose}>
      <div className={`${styles.modal} modalIn`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEditing ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
          <button className={styles.iconBtn} onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className={styles.form}>
          <div className={styles.typeToggle}>
            {(['expense', 'income'] as TransactionType[]).map(t => (
              <button key={t} type="button"
                className={`${styles.typeBtn} ${form.type === t ? (t === 'income' ? styles.typeBtnIncomeActive : styles.typeBtnExpenseActive) : ''}`}
                onClick={() => setForm(f => ({ ...f, type: t, categoryId: '' }))}>
                <Icon name={t === 'income' ? 'arrow-down' : 'arrow-up'} size={14} />
                {t === 'income' ? 'Ingreso' : 'Gasto'}
              </button>
            ))}
          </div>
          <div className={styles.formGrid}>
            <label className={styles.label}>Importe (€)<input className={styles.input} type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required placeholder="0,00" /></label>
            <label className={styles.label}>Fecha<input className={styles.input} type="date" value={form.date} onChange={set('date')} required /></label>
          </div>
          <label className={styles.label}>Categoría
            <select className={styles.input} value={form.categoryId} onChange={set('categoryId')}>
              <option value="">Sin categoría</option>
              {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className={styles.label}>Descripción<input className={styles.input} type="text" value={form.description} onChange={set('description')} placeholder="Opcional" maxLength={255} /></label>
          {mutation.isError && <p className={styles.formError}>{(mutation.error as Error).message}</p>}
          <div className={styles.modalActions}>
            {isEditing && (
              <button type="button" className={styles.deleteBtn} onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                <Icon name="trash" size={14} />{deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            )}
            <button type="submit" className={styles.submitBtn} disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Añadir movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export function TransactionsPage() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState<TransactionType | ''>('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo]     = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<Transaction | null>(null)
  const [exporting, setExporting]   = useState(false)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', filterType, filterFrom, filterTo],
    queryFn: () => api.transactions.list({
      ...(filterType ? { type: filterType } : {}),
      ...(filterFrom ? { from: filterFrom } : {}),
      ...(filterTo   ? { to: filterTo }     : {}),
      limit: 200,
    }),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'], queryFn: () => api.categories.list(), staleTime: Infinity,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions
    const q = search.toLowerCase()
    return transactions.filter(t => t.description?.toLowerCase().includes(q) || t.category?.name?.toLowerCase().includes(q))
  }, [transactions, search])

  const totalIncome  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  function openEdit(t: Transaction) { setEditing(t); setModalOpen(true) }
  function openNew()                { setEditing(null); setModalOpen(true) }
  function closeModal()             { setEditing(null); setModalOpen(false) }

  async function handleExport() {
    if (!session?.access_token) return
    setExporting(true)
    try { await downloadCSV({ type: filterType || undefined, from: filterFrom || undefined, to: filterTo || undefined }, session.access_token) }
    finally { setExporting(false) }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Movimientos</h1>
          <p className={styles.pageSubtitle}>Registro completo de ingresos y gastos</p>
        </div>
        <button className={styles.primaryBtn} onClick={openNew}>
          <Icon name="plus" size={15} /> Nuevo movimiento
        </button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Icon name="search" size={15} color="var(--color-text-muted)" />
          <input className={styles.searchInput} type="text" placeholder="Buscar por descripción o categoría..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className={styles.clearSearch} onClick={() => setSearch('')}><Icon name="close" size={13} /></button>}
        </div>
        <div className={styles.filters}>
          <select className={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value as TransactionType | '')}>
            <option value="">Todos los tipos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
          </select>
          <input className={styles.filterDate} type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="Desde" />
          <input className={styles.filterDate} type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   title="Hasta" />
          <button className={styles.exportBtn} onClick={handleExport} disabled={exporting} title="Exportar CSV">
            <Icon name="download" size={15} />{exporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {/* Summary strip + donut inline */}
      {filtered.length > 0 && (
        <div className={styles.summaryStrip}>
          <span className={styles.summaryCount}>{filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}</span>
          <span className={styles.summaryIncome}><Icon name="arrow-down" size={12} /> {fmt(totalIncome)}</span>
          <span className={styles.summaryExpense}><Icon name="arrow-up" size={12} /> {fmt(totalExpense)}</span>
          <span className={`${styles.summaryBalance} ${totalIncome - totalExpense >= 0 ? styles.positive : styles.negative}`}>
            Balance: {fmt(totalIncome - totalExpense)}
          </span>
          <div className={styles.summaryDonut}>
            <DonutSummary income={totalIncome} expense={totalExpense} />
          </div>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableWrap}>
        {isLoading && <div className={styles.tableEmpty}><span>Cargando movimientos...</span></div>}
        {!isLoading && filtered.length === 0 && (
          <div className={styles.tableEmpty}>
            <Icon name="transactions" size={32} color="var(--color-text-disabled)" />
            <span>{search ? 'Sin resultados para esa búsqueda' : 'Sin movimientos registrados'}</span>
            {!search && <button className={styles.primaryBtn} onClick={openNew}><Icon name="plus" size={14} /> Añadir el primero</button>}
          </div>
        )}
        {filtered.length > 0 && (
          <table className={styles.table}>
            <thead><tr>
              <th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tipo</th>
              <th className={styles.thRight}>Importe</th><th />
            </tr></thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} className={styles.tableRow} onClick={() => openEdit(tx)}>
                  <td className={styles.tdDate}>{fmtDate(typeof tx.date === 'string' ? tx.date : new Date(tx.date).toISOString())}</td>
                  <td className={styles.tdDesc}>{tx.description || <span className={styles.noDesc}>Sin descripción</span>}</td>
                  <td className={styles.tdCat}>
                    {tx.category
                      ? <span className={styles.catChip} style={{ '--cat-color': tx.category.color ?? 'var(--color-text-muted)' } as any}>{tx.category.name}</span>
                      : <span className={styles.noDesc}>—</span>}
                  </td>
                  <td>
                    <span className={`${styles.typeBadge} ${tx.type === 'income' ? styles.typeBadgeIncome : styles.typeBadgeExpense}`}>
                      {tx.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </td>
                  <td className={`${styles.tdAmount} ${tx.type === 'income' ? styles.amountIncome : styles.amountExpense}`}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  <td className={styles.tdAction}>
                    <button className={styles.iconBtn} onClick={e => { e.stopPropagation(); openEdit(tx) }}><Icon name="edit" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && <TransactionModal transaction={editing} categories={categories} onClose={closeModal} />}
    </div>
  )
}
