import type { VercelRequest, VercelResponse } from '@vercel/node'

// Add your production domain(s) to this list.
// VITE_APP_URL should be set in Vercel environment variables.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.VITE_APP_URL,          // e.g. https://moneytrack-xyz.vercel.app
].filter(Boolean) as string[])

/**
 * Sets CORS headers and handles OPTIONS preflight.
 * Returns true if the request should continue; false if it was a preflight
 * that has already been handled (caller must return early).
 *
 * Usage in any handler:
 *   if (!handleCors(req, res)) return
 */
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin ?? ''

  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')    // 24h preflight cache

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return false
  }

  return true
}
