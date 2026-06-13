import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import { api } from '@/lib/api'
import { Icon } from '@/components/ui/Icon'
import { MediaCarousel } from '@/components/ui/MediaCarousel'
import { Stagger, StaggerItem, AnimatedNumber } from '@/components/ui/Motion'
import styles from './DashboardPage.module.css'

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
}

function fmtCompact(n: number) {
  if (Math.abs(n) >= 1000) return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n)
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('es-ES', { month: 'short' })
}

function currentMonth() { return new Date().toISOString().slice(0, 7) }

function prevMonths(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (n - 1 - i))
    return d.toISOString().slice(0, 7)
  })
}

// ── Metric card ───────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string
  count?: number
  format?: (n: number) => string
  sub?: string
  trend?: number
  accent?: string
}

function MetricCard({ label, value, count, format, sub, trend, accent }: MetricCardProps) {
  const trendUp   = trend !== undefined && trend > 0
  const trendDown = trend !== undefined && trend < 0
  return (
    <div className={`${styles.metricCard} glow-hover`}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue} style={accent ? { color: accent } : undefined}>
        {count !== undefined && format ? <AnimatedNumber value={count} format={format} /> : value}
      </span>
      <div className={styles.metricFooter}>
        {trend !== undefined && (
          <span className={`${styles.metricTrend} ${trendUp ? styles.trendUp : trendDown ? styles.trendDown : styles.trendFlat}`}>
            {trendUp ? <Icon name="arrow-up" size={12} /> : trendDown ? <Icon name="arrow-down" size={12} /> : null}
            {Math.abs(trend).toFixed(1)}% vs mes anterior
          </span>
        )}
        {sub && !trend && <span className={styles.metricSub}>{sub}</span>}
      </div>
    </div>
  )
}

// ── Recent transaction row ────────────────────────────────────

function TxRow({ tx }: { tx: any }) {
  const isIncome = tx.type === 'income'
  return (
    <div className={styles.txRow}>
      <div className={`${styles.txIcon} ${isIncome ? styles.txIconIncome : styles.txIconExpense}`}>
        <Icon name={isIncome ? 'arrow-down' : 'arrow-up'} size={14} />
      </div>
      <div className={styles.txInfo}>
        <span className={styles.txName}>{tx.description || tx.category?.name || 'Sin descripción'}</span>
        <span className={styles.txMeta}>{tx.category?.name ?? 'Sin categoría'}</span>
      </div>
      <span className={`${styles.txAmount} ${isIncome ? styles.amountIncome : styles.amountExpense}`}>
        {isIncome ? '+' : '-'}{fmt(tx.amount)}
      </span>
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  )
}

// ── AI sidebar components ────────────────────────────────────

function AIInsightsCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai', 'insights'],
    queryFn: () => api.ai.insights(),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  return (
    <div className={styles.aiCard}>
      <div className={styles.aiCardHeader}>
        <div className={styles.aiCardIconWrap}>
          <Icon name="sparkle" size={13} color="var(--color-brand)" />
        </div>
        <span className={styles.aiCardTitle}>Consejo IA</span>
        <Link to="/insights" className={styles.aiCardLink}>
          Ver todo <Icon name="arrow-right" size={11} />
        </Link>
      </div>

      {isLoading && (
        <div className={styles.aiLoadingRow}>
          <div className={styles.spinner} />
          <span>Analizando...</span>
        </div>
      )}

      {isError && (
        <p className={styles.aiEmptyText}>No se pudo cargar el análisis IA.</p>
      )}

      {data && (
        data.insights.length > 0 ? (
          <div className={styles.aiInsightList}>
            {data.insights.slice(0, 3).map((ins, i) => (
              <div key={i} className={styles.aiInsightItem}>
                <span className={styles.aiInsightDot} style={{
                  background: ins.impact === 'high' ? 'var(--color-expense)' : ins.impact === 'medium' ? 'var(--color-warning)' : 'var(--color-income)'
                }} />
                <div>
                  <p className={styles.aiInsightTitle}>{ins.title}</p>
                  <p className={styles.aiInsightDesc}>{ins.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.aiEmptyText}>{data.summary}</p>
        )
      )}
    </div>
  )
}

function QuickAddCard() {
  return (
    <div className={styles.quickAddCard}>
      <span className={styles.quickAddLabel}>Acción rápida</span>
      <Link to="/transactions" className={styles.quickAddBtn}>
        <Icon name="plus" size={15} />
        Añadir movimiento
      </Link>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth())
  const months6 = prevMonths(6)

  const { data: stats } = useQuery({
    queryKey: ['stats', 'summary', month],
    queryFn: () => api.stats.summary(month),
  })

  const trendQueries = months6.map(m =>
    useQuery({
      queryKey: ['stats', 'summary', m],
      queryFn: () => api.stats.summary(m),
      staleTime: 5 * 60_000,
    })
  )

  const { data: recentTx } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => api.transactions.list({ limit: 8 }),
  })

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', month],
    queryFn: () => api.budgets.list(month),
  })

  const trendData = months6.map((m, i) => {
    const d = trendQueries[i]?.data
    return {
      month: monthLabel(m),
      Ingresos: d?.summary.totalIncome ?? 0,
      Gastos:   d?.summary.totalExpense ?? 0,
    }
  })

  const savingsRate = stats && stats.summary.totalIncome > 0
    ? ((stats.summary.totalIncome - stats.summary.totalExpense) / stats.summary.totalIncome) * 100
    : 0

  const topCategories = stats?.breakdown.expense.slice(0, 5) ?? []
  const warningBudgets = budgets.filter(b => b.percentage >= 80)

  const prevMonth = months6[months6.length - 2] ?? ''
  const { data: prevStats } = useQuery({
    queryKey: ['stats', 'summary', prevMonth],
    queryFn: () => api.stats.summary(prevMonth),
    enabled: !!prevMonth,
  })

  function expenseTrend() {
    if (!stats || !prevStats) return undefined
    const prev = prevStats.summary.totalExpense
    if (prev === 0) return undefined
    return ((stats.summary.totalExpense - prev) / prev) * 100
  }

  function incomeTrend() {
    if (!stats || !prevStats) return undefined
    const prev = prevStats.summary.totalIncome
    if (prev === 0) return undefined
    return ((stats.summary.totalIncome - prev) / prev) * 100
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Resumen financiero</h1>
          <p className={styles.pageSubtitle}>Vista general de tus finanzas personales</p>
        </div>
        <input type="month" className={styles.monthInput} value={month} max={currentMonth()} onChange={e => setMonth(e.target.value)} />
      </div>

      {/* ── Two-column layout ── */}
      <div className={styles.twoCol}>
        {/* ── Main column ── */}
        <div className={styles.mainCol}>
          {/* Metric cards */}
          <Stagger className={styles.metricsRow}>
            <StaggerItem>
              <MetricCard label="Balance" value="—" count={stats ? stats.summary.balance : undefined} format={(n) => fmt(n)} accent={stats && stats.summary.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)'} />
            </StaggerItem>
            <StaggerItem>
              <MetricCard label="Ingresos" value="—" count={stats ? stats.summary.totalIncome : undefined} format={(n) => fmt(n)} trend={incomeTrend()} accent="var(--color-income)" />
            </StaggerItem>
            <StaggerItem>
              <MetricCard label="Gastos" value="—" count={stats ? stats.summary.totalExpense : undefined} format={(n) => fmt(n)} trend={expenseTrend()} accent="var(--color-expense)" />
            </StaggerItem>
            <StaggerItem>
              <MetricCard label="Tasa de ahorro" value="—" count={stats ? savingsRate : undefined} format={(n) => `${n.toFixed(1)}%`} sub="del total de ingresos" accent={savingsRate >= 20 ? 'var(--color-income)' : savingsRate >= 0 ? 'var(--color-warning)' : 'var(--color-expense)'} />
            </StaggerItem>
          </Stagger>

          {/* Alert banner */}
          {warningBudgets.length > 0 && (
            <div className={styles.alertBanner}>
              <Icon name="alert" size={16} color="var(--color-warning)" />
              <span>
                {warningBudgets.length === 1
                  ? `El presupuesto de "${warningBudgets[0]!.categoryName}" está al ${warningBudgets[0]!.percentage.toFixed(0)}%`
                  : `${warningBudgets.length} presupuestos superan el 80% del límite mensual`}
              </span>
              <Link to="/budgets" className={styles.alertLink}>Ver presupuestos <Icon name="arrow-right" size={13} /></Link>
            </div>
          )}

          {/* Charts */}
          <div className={styles.chartsRow}>
            <div className={`${styles.chartCard} glow-hover`}>
              <div className={styles.chartCardHeader}>
                <span className={styles.chartCardTitle}>Evolución 6 meses</span>
                <div className={styles.legendRow}>
                  <span className={styles.legendDot} style={{ background: 'var(--color-income)' }} /> Ingresos
                  <span className={styles.legendDot} style={{ background: 'var(--color-expense)' }} /> Gastos
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="Ingresos" stroke="var(--color-income)" strokeWidth={2} fill="url(#gradIncome)" dot={false} />
                  <Area type="monotone" dataKey="Gastos"   stroke="var(--color-expense)" strokeWidth={2} fill="url(#gradExpense)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className={`${styles.chartCard} glow-hover`}>
              <div className={styles.chartCardHeader}>
                <span className={styles.chartCardTitle}>Top categorías de gasto</span>
              </div>
              {topCategories.length === 0 ? (
                <p className={styles.chartEmpty}>Sin datos este mes</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topCategories} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                    <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: 'var(--color-border)' }} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={14}>
                      {topCategories.map((c, i) => (
                        <Cell key={i} fill={c.color ?? 'var(--color-brand)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent transactions */}
          <div className={styles.recentCard}>
            <div className={styles.recentHeader}>
              <span className={styles.chartCardTitle}>Últimos movimientos</span>
              <Link to="/transactions" className={styles.viewAllLink}>
                Ver todos <Icon name="arrow-right" size={13} />
              </Link>
            </div>
            <div className={styles.txList}>
              {recentTx?.length === 0 && <p className={styles.chartEmpty}>Sin movimientos registrados</p>}
              {recentTx?.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </div>
          </div>
        </div>

        {/* ── Right sidebar: AI + quick-add ── */}
        <aside className={styles.sideCol}>
          <AIInsightsCard />
          <QuickAddCard />
        </aside>

        {/* ── Far-right: media carousel ── */}
        <div className={styles.carouselCol}>
          <MediaCarousel />
        </div>
      </div>
    </div>
  )
}
