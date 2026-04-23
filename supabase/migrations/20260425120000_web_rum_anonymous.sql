-- Muestras RUM sin sesión (Core Web Vitals / boot), ingestadas solo vía Edge (service role).
create table if not exists public.web_rum_anonymous (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_name text not null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists web_rum_anonymous_created_idx
  on public.web_rum_anonymous (created_at desc);

create index if not exists web_rum_anonymous_name_idx
  on public.web_rum_anonymous (event_name, created_at desc);

alter table public.web_rum_anonymous enable row level security;

-- Lectura: staff (misma idea que observabilidad_events).
drop policy if exists web_rum_anonymous_select_staff on public.web_rum_anonymous;
create policy web_rum_anonymous_select_staff
on public.web_rum_anonymous
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'superadmin', 'owner', 'coach')
  )
);

-- Sin política INSERT para rol authenticated: solo service role (Edge) inserta.

comment on table public.web_rum_anonymous is 'RUM web anónimo; insert via Edge ingest-rum-anon.';
