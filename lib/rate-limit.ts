import type { VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './supabase/admin'

// Max forced AI calls per user per endpoint within the time window
const WINDOW_MS   = 60 * 60 * 1000  // 1 hour
const MAX_REQUESTS = 5               // 5 forced calls / hour / user

export type RateLimitedEndpoint = 'insights' | 'predict'

/**
 * Sliding-window rate limiter backed by Supabase (no Redis needed).
 * Uses the service-role client — RLS is bypassed intentionally here.
 *
 * Returns true if the request is ALLOWED; false and sends 429 if blocked.
 * Only call this when the user is explicitly bypassing the cache (?force=1).
 */
export async function checkRateLimit(
  res: VercelResponse,
  userId: string,
  endpoint: RateLimitedEndpoint
): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()

  // Count requests within the sliding window
  const { count, error: countError } = await supabaseAdmin
    .from('ai_request_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('created_at', windowStart)

  if (countError) {
    // On DB error: fail open (allow the request) to avoid blocking legit users
    console.error('[rate-limit] count error:', countError.message)
    return true
  }

  if ((count ?? 0) >= MAX_REQUESTS) {
    res.status(429).json({
      data: null,
      error: {
        message: `Límite de ${MAX_REQUESTS} llamadas forzadas por hora alcanzado. Espera un momento.`,
        code: 'RATE_LIMITED',
        retryAfterMs: WINDOW_MS,
      },
    })
    return false
  }

  // Log the current request (fire-and-forget, don't block on it)
  supabaseAdmin
    .from('ai_request_log')
    .insert({ user_id: userId, endpoint })
    .then(({ error }) => {
      if (error) console.error('[rate-limit] insert error:', error.message)
    })

  return true
}
