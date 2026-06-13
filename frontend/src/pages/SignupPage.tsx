import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import styles from './AuthPage.module.css'

export function SignupPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/', { replace: true })
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.card} modalIn`}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 010-4h14v4"/>
              <path d="M3 5v14a2 2 0 002 2h16v-5"/>
              <path d="M18 12a2 2 0 000 4h4v-4z"/>
            </svg>
          </div>
          <span className={styles.brandName}>MoneyTrack</span>
        </div>

        <h1 className={styles.heading}>Crea tu cuenta</h1>
        <p className={styles.subheading}>Gratis, sin tarjeta de crédito</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Nombre completo
            <input className={styles.input} type="text" value={fullName} onChange={e => setFullName(e.target.value)} required autoComplete="name" placeholder="Tu nombre" />
          </label>

          <label className={styles.label}>
            Email
            <input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="tu@email.com" />
          </label>

          <label className={styles.label}>
            Contraseña
            <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className={styles.footer}>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
