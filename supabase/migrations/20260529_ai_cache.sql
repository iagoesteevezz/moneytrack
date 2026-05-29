-- AI response cache table
-- TTL: 6 hours. One row per (user_id, endpoint).
create table if not exists public.ai_cache (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,                    -- 'insights' | 'predict'
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- RLS: users can only read/write their own rows
alter table public.ai_cache enable row level security;

create policy "ai_cache: own rows only"
  on public.ai_cache
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists ai_cache_user_endpoint
  on public.ai_cache (user_id, endpoint);
