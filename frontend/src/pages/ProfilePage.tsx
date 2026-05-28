import { useState, useEffect, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import styles from './ProfilePage.module.css'

const CURRENCIES = [
  { code: 'EUR', label: '€ Euro' },
  { code: 'USD', label: '$ Dólar USD' },
  { code: 'GBP', label: '£ Libra esterlina' },
  { code: 'MXN', label: '$ Peso mexicano' },
  { code: 'ARS', label: '$ Peso argentino' },
  { code: 'COP', label: '$ Peso colombiano' },
  { code: 'CLP', label: '$ Peso chileno' },
  { code: 'BRL', label: 'R$ Real brasileño' },
]

export function ProfilePage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.auth.me(),
  })

  const [fullName, setFullName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [saved, setSaved] = useState(false)

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName ?? '')
      setCurrency(profile.currency)
    }
  }, [profile])

  const mutation = useMutation({
    mutationFn: () => api.auth.updateProfile({ fullName: fullName || undefined, currency }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Perfil</h2>

      {isLoading ? (
        <p className={styles.empty}>Cargando...</p>
      ) : (
        <div className={styles.card}>
          {/* ── Account info (read-only) ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Cuenta</h3>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{user?.email}</span>
            </div>
          </section>

          <hr className={styles.divider} />

          {/* ── Editable fields ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Preferencias</h3>
            <form onSubmit={handleSubmit} className={styles.form}>
              <label className={styles.label}>
                Nombre completo
                <input
                  className={styles.input}
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Tu nombre"
                  maxLength={100}
                />
              </label>

              <label className={styles.label}>
                Moneda principal
                <select
                  className={styles.input}
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </label>

              {mutation.isError && (
                <p className={styles.error}>{(mutation.error as Error).message}</p>
              )}

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
                {saved && <span className={styles.savedBadge}>✓ Guardado</span>}
              </div>
            </form>
          </section>

          <hr className={styles.divider} />

          {/* ── Danger zone ── */}
          <section className={styles.section}>
            <h3 className={`${styles.sectionTitle} ${styles.danger}`}>Zona de peligro</h3>
            <p className={styles.dangerText}>
              Para eliminar tu cuenta contacta con soporte. Esta acción es irreversible.
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
