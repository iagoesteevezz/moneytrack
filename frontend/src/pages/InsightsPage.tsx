import { useQuery } from '@tanstack/react-query'
import { api, type Insight, type CategoryPrediction } from '@/lib/api'
import { Icon } from '@/components/ui/Icon'
import styles from './InsightsPage.module.css'

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })
}

// ── Insight card ──────────────────────────────────────────────

const INSIGHT_ICON: Record<Insight['type'], 'alert' | 'trending-up' | 'info' | 'check'> = {
  anomaly:    'alert',
  trend:      'trending-up',
  suggestion: 'info',
  positive:   'check',
}

const IMPACT_COLOR: Record<Insight['impact'], string> = {
  high:   'var(--color-expense)',
  medium: 'var(--color-warning)',
  low:    'var(--color-text-muted)',
}

const IMPACT_LABEL: Record<Insight['impact'], string> = {
  high: 'Alto impacto', medium: 'Impacto medio', low: 'Bajo impacto',
}

const TYPE_BG: Record<Insight['type'], string> = {
  anomaly:    'var(--color-expense-bg)',
  trend:      '#eff6ff',
  suggestion: '#f0fdf4',
  positive:   '#f0fdf4',
}

const TYPE_ICON_COLOR: Record<Insight['type'], string> = {
  anomaly:    'var(--color-expense)',
  trend:      'var(--color-brand)',
  suggestion: 'var(--color-income)',
  positive:   'var(--color-income)',
}

function InsightCard({ insight }: { insight: Insight }) {
  const iconName  = INSIGHT_ICON[insight.type]
  const iconColor = TYPE_ICON_COLOR[insight.type]
  const bg        = TYPE_BG[insight.type]

  return (
    <div className={styles.insightCard}>
      <div className={styles.insightIconWrap} style={{ background: bg }}>
        <Icon name={iconName} size={16} color={iconColor} />
      </div>
      <div className={styles.insightBody}>
        <div className={styles.insightTop}>
          <span className={styles.insightTitle}>{insight.title}</span>
          <span className={styles.insightImpact} style={{ color: IMPACT_COLOR[insight.impact] }}>
            {IMPACT_LABEL[insight.impact]}
          </span>
        </div>
        <p className={styles.insightDesc}>{insight.description}</p>
        {insight.category && (
          <span className={styles.insightCat}>{insight.category}</span>
        )}
      </div>
    </div>
  )
}

// ── Prediction row ────────────────────────────────────────────

function PredictionRow({ p }: { p: CategoryPrediction }) {
  const diff   = p.predictedAmount - p.lastMonthAmount
  const isUp   = p.trend === 'up'
  const isDown = p.trend === 'down'

  return (
    <div className={styles.predRow}>
      <div className={styles.predLeft}>
        <span className={styles.predCategory}>{p.category}</span>
        <span className={styles.predReasoning}>{p.reasoning}</span>
      </div>
      <div className={styles.predRight}>
        <span className={styles.predAmount}>{fmt(p.predictedAmount)}</span>
        <div className={styles.predMeta}>
          <span className={styles.predTrend} style={{ color: isUp ? 'var(--color-expense)' : isDown ? 'var(--color-income)' : 'var(--color-text-muted)' }}>
            <Icon name={isUp ? 'trending-up' : isDown ? 'trending-down' : 'arrow-right'} size={12} />
            {diff !== 0 ? ` ${diff > 0 ? '+' : ''}${fmt(diff)}` : ' Sin cambio'}
          </span>
          <span className={styles.predConf}>
            Confianza: {p.confidence === 'high' ? 'Alta' : p.confidence === 'medium' ? 'Media' : 'Baja'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── States ────────────────────────────────────────────────────

function LoadingState({ label }: { label: string }) {
  return (
    <div className={styles.stateBox}>
      <div className={styles.spinner} />
      <span>{label}</span>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className={styles.errorBox}>
      <Icon name="alert" size={16} color="var(--color-expense)" />
      <span>{message}</span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className={styles.emptyText}>{message}</p>
}

// ── Main page ─────────────────────────────────────────────────

export function InsightsPage() {
  const insights = useQuery({
    queryKey: ['ai', 'insights'],
    queryFn: () => api.ai.insights(),
    staleTime: 5 * 60_000,
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
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Análisis IA</h1>
          <p className={styles.pageSubtitle}>Análisis inteligente de tus finanzas basado en tu historial</p>
        </div>
        <div className={styles.aiChip}>
          <Icon name="sparkle" size={14} color="var(--color-brand)" />
          Gemini 1.5 Flash
        </div>
      </div>

      {/* ── Insights section ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Insights del periodo</h2>

        {insights.isLoading && <LoadingState label="Analizando tus finanzas..." />}
        {insights.isError   && <ErrorState message={(insights.error as Error).message} />}

        {insights.data && (
          <>
            {insights.data.monthsAnalyzed > 0 && (
              <div className={styles.summaryBox}>
                <div className={styles.summaryBoxIcon}>
                  <Icon name="info" size={15} color="var(--color-brand)" />
                </div>
                <div>
                  <p className={styles.summaryText}>{insights.data.summary}</p>
                  <span className={styles.summaryMeta}>
                    Basado en {insights.data.monthsAnalyzed} {insights.data.monthsAnalyzed === 1 ? 'mes' : 'meses'} de datos
                  </span>
                </div>
              </div>
            )}

            {insights.data.insights.length === 0
              ? <EmptyState message={insights.data.summary} />
              : (
                <div className={styles.insightList}>
                  {insights.data.insights.map((ins, i) => (
                    <InsightCard key={i} insight={ins} />
                  ))}
                </div>
              )
            }
          </>
        )}
      </section>

      {/* ── Predictions section ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {predict.data ? `Predicción para ${formatMonth(predict.data.targetMonth)}` : 'Predicción próximo mes'}
        </h2>

        {predict.isLoading && <LoadingState label="Calculando predicciones..." />}
        {predict.isError   && <ErrorState message={(predict.error as Error).message} />}

        {predict.data && predict.data.categories.length === 0 && (
          <EmptyState message={predict.data.advice} />
        )}

        {predict.data && predict.data.categories.length > 0 && (
          <>
            {/* Summary totals */}
            <div className={styles.predSummary}>
              <div className={styles.predSummaryCard}>
                <span className={styles.predSummaryLabel}>Gastos estimados</span>
                <span className={styles.predSummaryValue} style={{ color: 'var(--color-expense)' }}>
                  {fmt(predict.data.predictedTotalExpense)}
                </span>
              </div>
              <div className={styles.predSummaryCard}>
                <span className={styles.predSummaryLabel}>Ingresos estimados</span>
                <span className={styles.predSummaryValue} style={{ color: 'var(--color-income)' }}>
                  {fmt(predict.data.predictedTotalIncome)}
                </span>
              </div>
              <div className={styles.predSummaryCard}>
                <span className={styles.predSummaryLabel}>Balance estimado</span>
                <span className={styles.predSummaryValue} style={{ color: predict.data.predictedBalance >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                  {fmt(predict.data.predictedBalance)}
                </span>
              </div>
            </div>

            {predict.data.advice && (
              <div className={styles.adviceBox}>
                <div className={styles.adviceIcon}>
                  <Icon name="info" size={14} color="var(--color-brand)" />
                </div>
                <p className={styles.adviceText}>{predict.data.advice}</p>
              </div>
            )}

            <div className={styles.predList}>
              {[...predict.data.categories]
                .sort((a, b) => b.predictedAmount - a.predictedAmount)
                .map((p, i) => <PredictionRow key={i} p={p} />)
              }
            </div>
          </>
        )}
      </section>
    </div>
  )
}
