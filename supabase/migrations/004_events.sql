-- ============================================================
-- MoneyTrack - Events / Trips ("Viajes y Eventos")
-- Agrupa transacciones existentes para comparar el coste de viajes.
-- ============================================================

-- ── FASE 1.1 · Tabla events ──────────────────────────────────
create table public.events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 100),
  destination text,
  start_date  date not null,
  end_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Una fecha de fin nunca puede ser anterior a la de inicio.
  -- (end_date opcional → viaje en curso / sin cierre definido)
  constraint chk_event_dates check (end_date is null or end_date >= start_date)
);

create index idx_events_user_start on public.events(user_id, start_date desc);

create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ── FASE 1.2 · Vincular transactions ↔ events ────────────────
-- ON DELETE SET NULL: al borrar un viaje, sus movimientos se conservan
-- (solo se "desagrupan"), evitando pérdida de datos financieros.
alter table public.transactions
  add column event_id uuid references public.events(id) on delete set null;

create index idx_transactions_event on public.transactions(event_id)
  where event_id is not null;

-- ── FASE 1.3 · RLS súper estricta sobre events ───────────────
alter table public.events enable row level security;

create policy "Users can view their own events"
  on public.events for select
  using (user_id = auth.uid());

-- WITH CHECK impide insertar filas con un user_id falsificado:
-- aunque el cliente envíe otro user_id, la fila se rechaza.
create policy "Users can insert their own events"
  on public.events for insert
  with check (user_id = auth.uid());

-- USING decide qué filas puede tocar; WITH CHECK valida el resultado,
-- bloqueando intentos de "reasignar" un evento a otro usuario.
create policy "Users can update their own events"
  on public.events for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own events"
  on public.events for delete
  using (user_id = auth.uid());

-- ── FASE 1.4 · Endurecer RLS de transactions ─────────────────
-- La política de UPDATE original solo comprobaba la propiedad del
-- movimiento. Eso permitiría vincular un movimiento propio a un
-- event_id AJENO. Reemplazamos la política para exigir, en el WITH
-- CHECK, que el event_id (si existe) pertenezca al mismo usuario.
drop policy if exists "Users can update their own transactions" on public.transactions;

create policy "Users can update their own transactions"
  on public.transactions for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      event_id is null
      or exists (
        select 1 from public.events e
        where e.id = transactions.event_id
          and e.user_id = auth.uid()
      )
    )
  );
