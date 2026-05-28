/**
 * Local development server.
 * Mounts all Vercel Function handlers onto an Express router.
 *
 * The handlers are written against VercelRequest/VercelResponse, which extend
 * Node's IncomingMessage/ServerResponse — the same base types Express uses.
 * No adapter layer needed: just pass req/res directly.
 *
 * Production: Vercel invokes each /api/*.ts file independently.
 * Local:      ts-node-dev runs this file as a single Express process.
 */

import 'dotenv/config'
import express from 'express'

// ── Route handlers (Vercel Functions) ───────────────────────
import authMe                from './auth/me'
import authProfile           from './auth/profile'
import aiInsights            from './ai/insights'
import aiPredict             from './ai/predict'
import budgets               from './budgets/index'
import transactionsIndex     from './transactions/index'
import transactionById       from './transactions/[id]'
import categoriesIndex       from './categories/index'
import statsSummary          from './stats/summary'

const app = express()

app.use(express.json())

// ── Mount routes ─────────────────────────────────────────────
// Cast needed because Express req/res are compatible at runtime
// but TypeScript sees slightly different types at compile time.
type Handler = (req: any, res: any) => Promise<void>

app.all('/api/auth/me',              authMe           as Handler)
app.all('/api/auth/profile',        authProfile      as Handler)
app.all('/api/transactions',         transactionsIndex as Handler)
app.all('/api/transactions/:id',     transactionById   as Handler)
app.all('/api/categories',           categoriesIndex   as Handler)
app.all('/api/stats/summary',        statsSummary      as Handler)
app.all('/api/budgets',             budgets           as Handler)
app.all('/api/ai/insights',         aiInsights        as Handler)
app.all('/api/ai/predict',          aiPredict         as Handler)

// ── 404 fallback ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ data: null, error: { message: 'Route not found', code: 'NOT_FOUND' } })
})

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env['PORT'] ?? 3001

app.listen(PORT, () => {
  console.log(`\n🚀 MoneyTrack API running at http://localhost:${PORT}`)
  console.log('   Routes:')
  console.log('   GET  /api/auth/me')
  console.log('   GET  /api/transactions')
  console.log('   POST /api/transactions')
  console.log('   GET  /api/transactions/:id')
  console.log('   PATCH /api/transactions/:id')
  console.log('   DELETE /api/transactions/:id')
  console.log('   GET  /api/categories')
  console.log('   POST /api/categories')
  console.log('   GET  /api/stats/summary\n')
})
