/**
 * Primitivas de animación reutilizables sobre Framer Motion.
 * Mantienen una curva de easing y timings consistentes en toda la app.
 */
import { motion, useSpring, useTransform, type Variants } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'

const EASE = [0.22, 1, 0.36, 1] as const

// ── Contenedor con entrada escalonada de hijos ────────────────
const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}

// ── Fade-in simple ────────────────────────────────────────────
export function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

// ── Número animado (cuenta hasta el valor) ────────────────────
export function AnimatedNumber({
  value,
  format = (n) => n.toFixed(0),
  className,
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const spring = useSpring(0, { stiffness: 90, damping: 18, mass: 0.8 })
  const text = useTransform(spring, (n) => format(n))

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return <motion.span className={className}>{text}</motion.span>
}
