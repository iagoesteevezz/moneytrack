-- ============================================================
-- MoneyTrack - Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles    enable row level security;
alter table public.categories  enable row level security;
alter table public.transactions enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert is handled by the trigger (security definer), not directly by users

-- ============================================================
-- CATEGORIES
-- Users can read: system categories + their own
-- Users can write: only their own (non-system)
-- ============================================================
create policy "Users can view system and own categories"
  on public.categories for select
  using (
    system_default = true
    or user_id = auth.uid()
  );

create policy "Users can insert their own categories"
  on public.categories for insert
  with check (
    system_default = false
    and user_id = auth.uid()
  );

create policy "Users can update their own categories"
  on public.categories for update
  using (user_id = auth.uid() and system_default = false)
  with check (user_id = auth.uid() and system_default = false);

create policy "Users can delete their own categories"
  on public.categories for delete
  using (user_id = auth.uid() and system_default = false);

-- ============================================================
-- TRANSACTIONS
-- Full CRUD scoped strictly to the owner
-- ============================================================
create policy "Users can view their own transactions"
  on public.transactions for select
  using (user_id = auth.uid());

create policy "Users can insert their own transactions"
  on public.transactions for insert
  with check (user_id = auth.uid());

create policy "Users can update their own transactions"
  on public.transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own transactions"
  on public.transactions for delete
  using (user_id = auth.uid());
