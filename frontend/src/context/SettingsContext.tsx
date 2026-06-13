/**
 * Preferencias de UI persistidas en localStorage.
 *  - theme: 'dark' | 'light'  → aplica data-theme al <html>
 *  - showCarousel: boolean    → muestra/oculta el carrusel de fotos del Dashboard
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

interface SettingsValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  showCarousel: boolean
  setShowCarousel: (v: boolean) => void
}

const SettingsContext = createContext<SettingsValue | null>(null)

const THEME_KEY = 'mt_theme'
const CAROUSEL_KEY = 'mt_show_carousel'

function readTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  // Por defecto, respeta la preferencia del sistema (cae a oscuro).
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function readCarousel(): boolean {
  return localStorage.getItem(CAROUSEL_KEY) !== 'false' // visible por defecto
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState]       = useState<Theme>(readTheme)
  const [showCarousel, setCarousel]  = useState<boolean>(readCarousel)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(CAROUSEL_KEY, String(showCarousel))
  }, [showCarousel])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  const setShowCarousel = (v: boolean) => setCarousel(v)

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, setTheme, showCarousel, setShowCarousel }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
