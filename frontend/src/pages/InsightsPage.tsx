import { useQuery } from '@tanstack/react-query'
import { api, type Insight, type CategoryPrediction } from '@/lib/api'
import styles from './InsightsPage.module.css'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function formatMonth(ym: string) {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })
}

// ── Insight card ──────────────────────────────────────────────

const INSIGHT_ICONS: Record<Insight['type'], string> = {
  anomaly:    '⚠️',
  trend:      '📈',
  suggestion: '💡',
  positive:   '✅',
}

const IMPACT_COLORS: Record<Insight['impact'], string> = {
  high:   '#dc2626',
  medium: '#f97316',
  low:    '#6b7280',
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className={`${styles.insightCard} ${styles[`insight_${insight.type}`]}`}>
      <div className={styles.insightHeader}>
        <span className={styles.insightIcon}>{INSIGHT_ICONS[insight.type]}</span>
        <div className={styles.insightMeta}>
          <span className={styles.insightTitle}>{insight.title}</span>
          <span
            className={styles.insightImpact}
            style={{ color: IMPACT_COLORS[insight.impact] }}
          >
            {insight.impact === 'high' ? 'Alto impacto' : insight.impact === 'medium' ? 'Medio impacto' : 'Bajo impacto'}
          </span>
        </div>
      </div>
      <p className={styles.insightDesc}>{insight.description}</p>
      {insight.category && (
        <span className={styles.insightCategory}>📂 {insight.category}</span>
      )}
    </div>
  )
}

// ── Prediction row ────────────────────────────────────────────

const TREND_ICONS = { up: '↑', down: '↓', stable: '→' }
const TREND_COLORS = { up: '#dc2626', down: '#16a34a', stable: '#6b7280' }
const CONFIDENCE_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' }

function PredictionRow({ p }: { p: CategoryPrediction }) {
  const diff = p.predictedAmount - p.lastMonthAmount
  return (
    <div className={styles.predRow}>
      <div className={styles.predLeft}>
        <span className={styles.predCategory}>{p.category}</span>
        <span className={styles.predReasoning}>{p.reasoning}</span>
      </div>
      <div className={styles.predRight}>
        <span className={styles.predAmount}>{formatCurrency(p.predictedAmount)}</span>
        <div className={styles.predMeta}>
          <span style={{ color: TREND_COLORS[p.trend], fontWeight: 600 }}>
            {TREND_ICONS[p.trend]} {diff !== 0 ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : ''}
          </span>
          <span className={styles.predConfidence}>
            Confianza: {CONFIDENCE_LABELS[p.confidence]}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

export function InsightsPage() {
  const insights = useQuery({
    queryKey: ['ai', 'insights'],
    queryFn: () => api.ai.insights(),
    staleTime: 5 * 60_000,   // 5 min — expensive call, don't re-fetch on every focus
    retry: 1,
  })

  const predict = useQuery({
    queryKey: ['ai', 'predict'],
    queryFn: () => api.ai.predict(),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>✨ Insights IA</h1>
        <p className={styles.pageSubtitle}>
          Análisis inteligente de tus finanzas basado en tu historial
        </p>
      </div>

      {/* ── Insights ── */}
      <Section title="Análisis del periodo">
        {insights.isLoading && <LoadingCard label="Analizando tus finanzas..." />}
        {insights.isError  && <ErrorCard message={(insights.error as Error).message} />}
        {insights.data && (
          <>
            {insights.data.monthsAnalyzed > 0 && (
              <div className={styles.summaryBox}>
                <p className={styles.summaryText}>{insights.data.summary}</p>
                <span className={styles.summaryMeta}>
                  Basado en {insights.data.monthsAnalyzed} mes{insights.data.monthsAnalyzed !== 1 ? 'es' : ''} de datos
                </span>
              </div>
            )}
            {insights.data.insights.length === 0 ? (
              <EmptyState message={insights.data.summary} />
            ) : (
              <div className={styles.insightList}>
                {insights.data.insights.map((ins, i) => (
                  <InsightCard key={i} insight={ins} />
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── Predictions ── */}
      <Section title={`Predicción para ${predict.data ? formatMonth(predict.data.targetMonth) : 'el próximo mes'}`}>
        {predict.isLoading && <LoadingCard label="Calculando predicciones..." />}
        {predict.isError  && <ErrorCard message={(predict.error as Error).message} />}
        {predict.data && (
          <>
            {predict.data.categories.length === 0 ? (
              <EmptyState message={predict.data.advice} />
            ) : (
              <>
                {/* Summary totals */}
                <div className={styles.predSummary}>
                  <div className={styles.predSummaryItem}>
                    <span className={styles.predSummaryLabel}>Gastos estimados</span>
                    <span className={`${styles.predSummaryValue} ${styles.expense}`}>
                      {formatCurrency(predict.data.predictedTotalExpense)}
                    </span>
                  </div>
                  <div className={styles.predSummaryItem}>
                    <span className={styles.predSummaryLabel}>Ingresos estimados</span>
                    <span className={`${styles.predSummaryValue} ${styles.income}`}>
                      {formatCurrency(predict.data.predictedTotalIncome)}
                    </span>
                  </div>
                  <div className={styles.predSummaryItem}>
                    <span className={styles.predSummaryLabel}>Balance estimado</span>
                    <span className={`${styles.predSummaryValue} ${predict.data.predictedBalance >= 0 ? styles.income : styles.expense}`}>
                      {formatCurrency(predict.data.predictedBalance)}
                    </span>
                  </div>
                </div>

                {predict.data.advice && (
                  <div className={styles.adviceBox}>
                    <span className={styles.adviceIcon}>💡</span>
                    <p className={styles.adviceText}>{predict.data.advice}</p>
                  </div>
                )}

                <div className={styles.predList}>
                  {predict.data.categories
                    .sort((a, b) => b.predictedAmount - a.predictedAmount)
                    .map((p, i) => <PredictionRow key={i} p={p} />)
                  }
                </div>
              </>
            )}
          </>
        )}
      </Section>
    </div>
  )
}

// ── Utility components ────────────────────────────────────────

function LoadingCard({ label }: { label: string }) {
  return (
    <div className={styles.loadingCard}>
      <span className={styles.loadingSpinner}>⏳</span>
      <span>{label}</span>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return <div className={styles.errorCard}>❌ {message}</div>
}

function EmptyState({ message }: { message: string }) {
  return <p className={styles.emptyState}>{message}</p>
}
