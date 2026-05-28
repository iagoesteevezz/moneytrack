import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { api, type CategoryBreakdown } from '@/lib/api'
import styles from './DashboardPage.module.css'

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className={styles.monthPicker}
      type="month"
      value={value}
      max={currentMonth()}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={styles.statCard} style={{ borderTopColor: color }}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  )
}

function BreakdownChart({ data, title }: { data: CategoryBreakdown[]; title: string }) {
  if (data.length === 0) return <p className={styles.empty}>Sin datos</p>

  return (
    <div className={styles.chartBlock}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.categoryId}
                fill={entry.color ?? `hsl(${i * 37}, 65%, 55%)`}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(name) => name}
          />
          <Legend
            formatter={(value) => <span style={{ fontSize: '0.8rem' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className={styles.breakdownList}>
        {data.map(b => (
          <div key={b.categoryId} className={styles.breakdownRow}>
            <span className={styles.breakdownIcon}>{b.icon ?? '📦'}</span>
            <span className={styles.breakdownName}>{b.categoryName}</span>
            <span className={styles.breakdownPct}>{b.percentage}%</span>
            <span className={styles.breakdownAmount}>{formatCurrency(b.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stats', 'summary', month],
    queryFn: () => api.stats.summary(month),
  })

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.topBar}>
          <h2 className={styles.pageTitle}>Resumen mensual</h2>
          <MonthPicker value={month} onChange={setMonth} />
        </div>

        {isLoading && <p className={styles.empty}>Cargando...</p>}
        {isError  && <p className={styles.error}>Error al cargar datos</p>}

        {data && (
          <>
            <div className={styles.statsRow}>
              <StatCard
                label="Ingresos"
                value={formatCurrency(data.summary.totalIncome)}
                color="#22c55e"
              />
              <StatCard
                label="Gastos"
                value={formatCurrency(data.summary.totalExpense)}
                color="#ef4444"
              />
              <StatCard
                label="Balance"
                value={formatCurrency(data.summary.balance)}
                color={data.summary.balance >= 0 ? '#6366f1' : '#f97316'}
              />
            </div>

            <div className={styles.chartsRow}>
              <BreakdownChart data={data.breakdown.income}  title="Ingresos por categoría" />
              <BreakdownChart data={data.breakdown.expense} title="Gastos por categoría" />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
