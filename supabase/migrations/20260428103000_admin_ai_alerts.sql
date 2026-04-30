create table if not exists public.admin_ai_alerts (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_key text not null,
  alert_type text not null,
  status text not null check (status in ('open', 'resolved')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null,
  cta_label text null,
  cta_route text null,
  metric_value numeric null,
  baseline_value numeric null,
  details jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  resolved_at timestamptz null,
  last_notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, alert_key)
);

create index if not exists admin_ai_alerts_org_status_idx
  on public.admin_ai_alerts (organization_id, status, observed_at desc);

create index if not exists admin_ai_alerts_org_type_idx
  on public.admin_ai_alerts (organization_id, alert_type, observed_at desc);

create or replace function public.set_admin_ai_alerts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_ai_alerts_updated_at on public.admin_ai_alerts;
create trigger trg_admin_ai_alerts_updated_at
before update on public.admin_ai_alerts
for each row execute function public.set_admin_ai_alerts_updated_at();

alter table public.admin_ai_alerts enable row level security;

drop policy if exists admin_ai_alerts_select_staff_org on public.admin_ai_alerts;
create policy admin_ai_alerts_select_staff_org
on public.admin_ai_alerts
for select
using (
  public.user_is_active_org_staff(organization_id)
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'superadmin'
  )
);

grant select on public.admin_ai_alerts to authenticated;
grant all on public.admin_ai_alerts to service_role;
