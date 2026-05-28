-- ============================================================
-- MoneyTrack - Budgets
-- ============================================================

create table public.budgets (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  amount       numeric(12, 2) not null check (amount > 0),
  period       text not null default 'monthly' check (period in ('monthly')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- One budget per user/category/period
  unique (user_id, category_id, period)
);

create index idx_budgets_user on public.budgets(user_id);

create trigger trg_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

alter table public.budgets enable row level security;

create policy "Users can view their own budgets"
  on public.budgets for select
  using (user_id = auth.uid());

create policy "Users can insert their own budgets"
  on public.budgets for insert
  with check (user_id = auth.uid());

create policy "Users can update their own budgets"
  on public.budgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own budgets"
  on public.budgets for delete
  using (user_id = auth.uid());
