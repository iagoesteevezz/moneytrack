import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ShoppingItem, type Priority } from '@/lib/api'
import { Icon } from '@/components/ui/Icon'
import styles from './ShoppingListPage.module.css'

// ── Helpers ───────────────────────────────────────────────────

type Tab = 'all' | 'pending' | 'by-priority' | 'by-category'

const PRIORITY_LABEL: Record<Priority, string> = {
  alta: 'Alta', media: 'Media', baja: 'Baja',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

// ── Priority badge ─────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`${styles.priorityBadge} ${styles[`priority_${priority}`]}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

// ── Notion-style checkbox ──────────────────────────────────────

function NotionCheckbox({ checked, onChange, disabled }: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ''}`}
      onClick={e => { e.stopPropagation(); onChange() }}
      disabled={disabled}
      aria-label={checked ? 'Desmarcar como comprado' : 'Marcar como comprado'}
    >
      {checked && <Icon name="check" size={10} color="#fff" strokeWidth={3} />}
    </button>
  )
}

// ── Purchase confirm modal ─────────────────────────────────────

function PurchaseModal({ item, onRegister, onJustMark, onCancel, isLoading }: {
  item: ShoppingItem
  onRegister: () => void
  onJustMark: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  return (
    <div className={`${styles.overlay} overlayIn`} onClick={onCancel}>
      <div className={`${styles.modal} ${styles.modalConfirm} modalIn`} onClick={e => e.stopPropagation()}>
        <div className={styles.confirmEmoji}>🛒</div>
        <h2 className={styles.confirmTitle}>¿Registrar como movimiento?</h2>
        <p className={styles.confirmDesc}>
          {item.estimatedPrice != null ? (
            <>
              ¿Quieres registrar <strong>{item.item}</strong> como un Gasto real por{' '}
              <strong>{fmt(item.estimatedPrice)}</strong>?
            </>
          ) : (
            <>¿Quieres registrar <strong>{item.item}</strong> como un Gasto real?</>
          )}
        </p>
        <div className={styles.confirmActions}>
          {item.estimatedPrice != null && (
            <button type="button" className={styles.primaryBtn} onClick={onRegister} disabled={isLoading}>
              <Icon name="check" size={14} />
              {isLoading ? 'Registrando...' : `Registrar ${fmt(item.estimatedPrice)}`}
            </button>
          )}
          <button type="button" className={styles.secondaryBtn} onClick={onJustMark} disabled={isLoading}>
            Solo marcar como comprado
          </button>
          <button type="button" className={styles.ghostBtn} onClick={onCancel} disabled={isLoading}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Item form modal (create / edit) ────────────────────────────

interface FormState {
  item: string; priority: Priority; category: string; estimatedPrice: string; notes: string
}
const emptyForm = (): FormState => ({
  item: '', priority: 'media', category: '', estimatedPrice: '', notes: '',
})

function ItemFormModal({ editItem, onClose }: {
  editItem: ShoppingItem | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEditing = editItem !== null

  const [form, setForm] = useState<FormState>(isEditing ? {
    item:           editItem.item,
    priority:       editItem.priority,
    category:       editItem.category ?? '',
    estimatedPrice: editItem.estimatedPrice != null ? String(editItem.estimatedPrice) : '',
    notes:          editItem.notes ?? '',
  } : emptyForm())

  const set = (f: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [f]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        item:           form.item.trim(),
        priority:       form.priority,
        category:       form.category.trim() || undefined,
        estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : null,
        notes:          form.notes.trim() || null,
      }
      return isEditing
        ? api.shoppingList.update(editItem.id, payload)
        : api.shoppingList.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shopping-list'] }); onClose() },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.shoppingList.delete(editItem!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shopping-list'] }); onClose() },
  })

  return (
    <div className={`${styles.overlay} overlayIn`} onClick={onClose}>
      <div className={`${styles.modal} modalIn`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEditing ? 'Editar artículo' : 'Nuevo artículo'}</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <form className={styles.form} onSubmit={e => { e.preventDefault(); saveMutation.mutate() }}>
          <label className={styles.label}>
            Artículo
            <input
              className={styles.input} type="text" value={form.item} onChange={set('item')}
              placeholder="Nombre del artículo" required maxLength={255} autoFocus
            />
          </label>

          <div className={styles.formGrid}>
            <label className={styles.label}>
              Prioridad
              <select className={styles.input} value={form.priority} onChange={set('priority')}>
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Media</option>
                <option value="baja">🟢 Baja</option>
              </select>
            </label>
            <label className={styles.label}>
              Categoría
              <input
                className={styles.input} type="text" value={form.category} onChange={set('category')}
                placeholder="Ej: Ropa, Electrónica..." maxLength={100}
              />
            </label>
          </div>

          <label className={styles.label}>
            Precio estimado (€)
            <input
              className={styles.input} type="number" min="0.01" step="0.01"
              value={form.estimatedPrice} onChange={set('estimatedPrice')} placeholder="0,00"
            />
          </label>

          <label className={styles.label}>
            Notas
            <input
              className={styles.input} type="text" value={form.notes} onChange={set('notes')}
              placeholder="Opcional..." maxLength={1000}
            />
          </label>

          {saveMutation.isError && (
            <p className={styles.formError}>{(saveMutation.error as Error).message}</p>
          )}

          <div className={styles.modalActions}>
            {isEditing && (
              <button
                type="button" className={styles.deleteBtn}
                onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
              >
                <Icon name="trash" size={14} />
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            )}
            <button type="submit" className={styles.submitBtn} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Añadir artículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Table row ──────────────────────────────────────────────────

function ItemRow({ item, onCheckbox, onEdit }: {
  item: ShoppingItem
  onCheckbox: () => void
  onEdit: () => void
}) {
  return (
    <tr
      className={`${styles.tableRow} ${item.isPurchased ? styles.rowPurchased : ''}`}
      onClick={onEdit}
    >
      <td className={styles.tdItem}>
        <Icon name="cart" size={13} color="var(--color-text-disabled)" />
        <span className={item.isPurchased ? styles.itemStrike : ''}>{item.item}</span>
      </td>
      <td><PriorityBadge priority={item.priority} /></td>
      <td>
        {item.category
          ? <span className={styles.catChip}>{item.category}</span>
          : <span className={styles.muted}>—</span>}
      </td>
      <td className={styles.tdCheckbox}>
        <NotionCheckbox checked={item.isPurchased} onChange={onCheckbox} />
      </td>
      <td className={styles.tdRight}>
        {item.estimatedPrice != null
          ? <span className={styles.price}>{fmt(item.estimatedPrice)}</span>
          : <span className={styles.muted}>—</span>}
      </td>
      <td className={styles.tdNotes}>
        {item.notes
          ? <span className={styles.notesText}>{item.notes}</span>
          : <span className={styles.muted}>—</span>}
      </td>
    </tr>
  )
}

// ── Group header row ───────────────────────────────────────────

function GroupRow({ label, count }: { label: string; count: number }) {
  return (
    <tr className={styles.groupRow}>
      <td colSpan={6} className={styles.groupCell}>
        {label}
        <span className={styles.groupCount}>{count}</span>
      </td>
    </tr>
  )
}

// ── Main page ──────────────────────────────────────────────────

export function ShoppingListPage() {
  const qc = useQueryClient()
  const [tab, setTab]                     = useState<Tab>('all')
  const [purchaseItem, setPurchaseItem]   = useState<ShoppingItem | null>(null)
  const [formItem, setFormItem]           = useState<ShoppingItem | 'new' | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: api.shoppingList.list,
  })

  // ── Derived ───────────────────────────────────────────────────

  const pending = useMemo(() => items.filter(i => !i.isPurchased), [items])

  const displayItems = useMemo(
    () => tab === 'pending' ? pending : items,
    [tab, items, pending]
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>()
    items.forEach(i => {
      const key = i.category ?? 'Sin categoría'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(i)
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [items])

  const totalEstimated = useMemo(
    () => pending.reduce((s, i) => s + (i.estimatedPrice ?? 0), 0),
    [pending]
  )

  // ── Mutations ─────────────────────────────────────────────────

  const unmarkMutation = useMutation({
    mutationFn: (id: string) => api.shoppingList.update(id, { isPurchased: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list'] }),
  })

  const purchaseMutation = useMutation({
    mutationFn: async ({ item, register }: { item: ShoppingItem; register: boolean }) => {
      await api.shoppingList.update(item.id, { isPurchased: true })
      if (register && item.estimatedPrice != null) {
        await api.transactions.create({
          type: 'expense',
          amount: item.estimatedPrice,
          description: item.item,
          date: new Date().toISOString().slice(0, 10),
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setPurchaseItem(null)
    },
  })

  // ── Handlers ─────────────────────────────────────────────────

  function handleCheckbox(item: ShoppingItem) {
    if (item.isPurchased) {
      unmarkMutation.mutate(item.id)
    } else {
      setPurchaseItem(item)
    }
  }

  // ── Tabs config ───────────────────────────────────────────────

  const TABS: { id: Tab; label: string }[] = [
    { id: 'all',         label: 'Todas las compras' },
    { id: 'by-priority', label: 'Por prioridad'     },
    { id: 'by-category', label: 'Por categoría'     },
    { id: 'pending',     label: 'Pendientes'         },
  ]

  const isEmpty = tab === 'pending'
    ? pending.length === 0
    : items.length === 0

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <Icon name="cart" size={22} />
            Lista de Compras
          </h1>
          <p className={styles.pageSubtitle}>
            {items.length === 0
              ? 'Empieza añadiendo tu primer artículo'
              : `${pending.length} pendiente${pending.length !== 1 ? 's' : ''} de ${items.length}`
                + (totalEstimated > 0 ? ` · Estimado: ${fmt(totalEstimated)}` : '')}
          </p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setFormItem('new')}>
          <Icon name="plus" size={15} /> Nuevo artículo
        </button>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'pending' && pending.length > 0 && (
              <span className={styles.tabCount}>{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        {isLoading && (
          <div className={styles.empty}>Cargando lista...</div>
        )}

        {!isLoading && isEmpty && (
          <div className={styles.empty}>
            <Icon name="cart" size={36} color="var(--color-text-disabled)" />
            <span>{tab === 'pending' ? 'No hay artículos pendientes' : 'Tu lista está vacía'}</span>
            {tab !== 'pending' && (
              <button type="button" className={styles.primaryBtn} onClick={() => setFormItem('new')}>
                <Icon name="plus" size={14} /> Añadir el primero
              </button>
            )}
          </div>
        )}

        {!isLoading && !isEmpty && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Prioridad</th>
                <th>Categoría</th>
                <th>Comprado</th>
                <th className={styles.thRight}>Precio estimado</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {tab === 'by-priority' &&
                (['alta', 'media', 'baja'] as Priority[]).map(priority => {
                  const group = items.filter(i => i.priority === priority)
                  if (group.length === 0) return null
                  return (
                    <React.Fragment key={priority}>
                      <GroupRow label={PRIORITY_LABEL[priority]} count={group.length} />
                      {group.map(item => (
                        <ItemRow key={item.id} item={item}
                          onCheckbox={() => handleCheckbox(item)}
                          onEdit={() => setFormItem(item)} />
                      ))}
                    </React.Fragment>
                  )
                })
              }

              {tab === 'by-category' &&
                byCategory.map(([cat, catItems]) => (
                  <React.Fragment key={cat}>
                    <GroupRow label={cat} count={catItems.length} />
                    {catItems.map(item => (
                      <ItemRow key={item.id} item={item}
                        onCheckbox={() => handleCheckbox(item)}
                        onEdit={() => setFormItem(item)} />
                    ))}
                  </React.Fragment>
                ))
              }

              {(tab === 'all' || tab === 'pending') &&
                displayItems.map(item => (
                  <ItemRow key={item.id} item={item}
                    onCheckbox={() => handleCheckbox(item)}
                    onEdit={() => setFormItem(item)} />
                ))
              }
            </tbody>
          </table>
        )}

        {/* Notion-style inline add */}
        {!isLoading && (
          <button type="button" className={styles.addRow} onClick={() => setFormItem('new')}>
            <Icon name="plus" size={13} color="var(--color-text-muted)" />
            Nuevo/a artículo
          </button>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {purchaseItem && (
        <PurchaseModal
          item={purchaseItem}
          onRegister={() => purchaseMutation.mutate({ item: purchaseItem, register: true })}
          onJustMark={() => purchaseMutation.mutate({ item: purchaseItem, register: false })}
          onCancel={() => setPurchaseItem(null)}
          isLoading={purchaseMutation.isPending}
        />
      )}

      {formItem !== null && (
        <ItemFormModal
          editItem={formItem === 'new' ? null : formItem}
          onClose={() => setFormItem(null)}
        />
      )}
    </div>
  )
}
