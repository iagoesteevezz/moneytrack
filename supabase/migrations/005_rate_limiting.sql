-- ============================================================
-- MoneyTrack - AI Rate Limiting Log
-- ============================================================
-- Tracks forced AI endpoint calls (bypassing cache) per user.
-- Only the service-role client writes here (no RLS policies = deny all
-- from anon/authenticated roles, admin-only access).
-- Old rows can be pruned with: DELETE FROM ai_request_log WHERE created_at < now() - interval '24 hours'
-- ============================================================

create table public.ai_request_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null check (endpoint in ('insights', 'predict')),
  created_at  timestamptz not null default now()
);

-- Composite index to make the sliding-window COUNT fast
create index idx_ai_request_log_lookup
  on public.ai_request_log(user_id, endpoint, created_at desc);

-- RLS enabled but NO policies defined → only service-role key can access
alter table public.ai_request_log enable row level security;
