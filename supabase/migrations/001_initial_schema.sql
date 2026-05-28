-- ============================================================
-- MoneyTrack - Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- Auto-created when a user signs up via auth trigger
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  currency    text not null default 'EUR',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES
-- system_default = true → visible to all users (read-only)
-- system_default = false → user-specific custom categories
-- ============================================================
create table public.categories (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade,
  name            text not null,
  icon            text,                          -- emoji or icon key
  color           text,                          -- hex color
  type            text not null check (type in ('income', 'expense', 'both')),
  system_default  boolean not null default false,
  created_at      timestamptz not null default now(),

  -- system categories have no user_id; user categories require one
  constraint chk_category_owner check (
    (system_default = true and user_id is null) or
    (system_default = false and user_id is not null)
  )
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table public.transactions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete set null,
  type          text not null check (type in ('income', 'expense')),
  amount        numeric(12, 2) not null check (amount > 0),
  description   text,
  date          date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes for common query patterns
create index idx_transactions_user_date on public.transactions(user_id, date desc);
create index idx_transactions_user_category on public.transactions(user_id, category_id);
create index idx_transactions_user_type on public.transactions(user_id, type);

-- ============================================================
-- UPDATED_AT TRIGGER (shared function)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED: DEFAULT CATEGORIES
-- ============================================================
insert into public.categories (name, icon, color, type, system_default) values
  ('Salario',        '💼', '#4CAF50', 'income',   true),
  ('Freelance',      '💻', '#8BC34A', 'income',   true),
  ('Inversiones',    '📈', '#009688', 'income',   true),
  ('Otros ingresos', '💰', '#00BCD4', 'income',   true),
  ('Alimentación',   '🛒', '#FF5722', 'expense',  true),
  ('Transporte',     '🚗', '#FF9800', 'expense',  true),
  ('Vivienda',       '🏠', '#795548', 'expense',  true),
  ('Salud',          '🏥', '#E91E63', 'expense',  true),
  ('Ocio',           '🎮', '#9C27B0', 'expense',  true),
  ('Ropa',           '👕', '#673AB7', 'expense',  true),
  ('Educación',      '📚', '#3F51B5', 'expense',  true),
  ('Suscripciones',  '📱', '#2196F3', 'expense',  true),
  ('Restaurantes',   '🍽️', '#F44336', 'expense',  true),
  ('Viajes',         '✈️', '#00ACC1', 'expense',  true),
  ('Otros gastos',   '📦', '#607D8B', 'expense',  true);
