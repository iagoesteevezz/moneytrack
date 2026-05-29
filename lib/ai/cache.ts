import type { SupabaseClient } from '@supabase/supabase-js'

const CACHE_TTL_HOURS = 6

export async function getCachedAI<T>(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
): Promise<T | null> {
  const { data, error } = await supabase
    .from('ai_cache')
    .select('payload, created_at')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .single()

  if (error || !data) return null

  const age = (Date.now() - new Date(data.created_at).getTime()) / 3_600_000
  if (age > CACHE_TTL_HOURS) return null

  return data.payload as T
}

export async function setCachedAI<T>(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  payload: T,
): Promise<void> {
  await supabase
    .from('ai_cache')
    .upsert(
      { user_id: userId, endpoint, payload, created_at: new Date().toISOString() },
      { onConflict: 'user_id,endpoint' },
    )
}
