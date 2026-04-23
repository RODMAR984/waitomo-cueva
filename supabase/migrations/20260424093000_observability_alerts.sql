create table if not exists public.observability_alerts (
  id bigint generated always as identity primary key,
  alert_key text not null unique,
  status text not null check (status in ('open', 'resolved')),
  severity text not null check (severity in ('warning', 'critical')),
  metric_name text not null,
  metric_value numeric null,
  threshold_value numeric null,
  window_minutes integer null,
  details jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  resolved_at timestamptz null,
  last_notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists observability_alerts_status_idx
  on public.observability_alerts (status, observed_at desc);

create index if not exists observability_alerts_metric_idx
  on public.observability_alerts (metric_name, observed_at desc);

create or replace function public.set_observability_alerts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_observability_alerts_updated_at on public.observability_alerts;
create trigger trg_observability_alerts_updated_at
before update on public.observability_alerts
for each row execute function public.set_observability_alerts_updated_at();

alter table public.observability_alerts enable row level security;

drop policy if exists observability_alerts_select_admin on public.observability_alerts;
create policy observability_alerts_select_admin
on public.observability_alerts
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'superadmin', 'owner', 'coach')
  )
);
