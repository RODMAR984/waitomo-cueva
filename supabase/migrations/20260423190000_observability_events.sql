create table if not exists public.observability_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  user_id uuid not null,
  organization_id uuid null,
  role text null,
  event_type text not null,
  event_name text not null,
  event_ts timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  error_message text null,
  stack text null,
  created_at timestamptz not null default now()
);

create index if not exists observability_events_user_idx
  on public.observability_events (user_id, created_at desc);

create index if not exists observability_events_org_idx
  on public.observability_events (organization_id, created_at desc);

alter table public.observability_events enable row level security;

drop policy if exists observability_events_select_admin on public.observability_events;
create policy observability_events_select_admin
on public.observability_events
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'superadmin', 'owner', 'coach')
  )
);
