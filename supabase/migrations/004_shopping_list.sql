-- ============================================================
-- MoneyTrack - Shopping List
-- ============================================================

create table public.shopping_list (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  item             text not null check (char_length(trim(item)) between 1 and 255),
  priority         text not null default 'media'
                     check (priority in ('alta', 'media', 'baja')),
  category         text check (category is null or char_length(trim(category)) between 1 and 100),
  is_purchased     boolean not null default false,
  estimated_price  numeric(12, 2) check (estimated_price is null or estimated_price > 0),
  notes            text check (notes is null or char_length(notes) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Composite index: most queries will filter by user + purchased status
create index idx_shopping_list_user         on public.shopping_list(user_id);
create index idx_shopping_list_user_status  on public.shopping_list(user_id, is_purchased);
create index idx_shopping_list_user_priority on public.shopping_list(user_id, priority);

create trigger trg_shopping_list_updated_at
  before update on public.shopping_list
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
-- Critical: a user can ONLY access rows where user_id = their session uid.
-- The WITH CHECK on INSERT prevents a malicious client from inserting
-- rows with a different user_id even if they forge the body.

alter table public.shopping_list enable row level security;

create policy "Users can view their own shopping list"
  on public.shopping_list for select
  using (user_id = auth.uid());

create policy "Users can insert their own shopping items"
  on public.shopping_list for insert
  with check (user_id = auth.uid());

create policy "Users can update their own shopping items"
  on public.shopping_list for update
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own shopping items"
  on public.shopping_list for delete
  using (user_id = auth.uid());
