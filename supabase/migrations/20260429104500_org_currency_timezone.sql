-- Internacionalización base por organización:
-- - moneda operativa principal (sin conversión entre monedas)
-- - zona horaria operativa del gym (cálculos diarios y "hoy")

alter table public.organizations
  add column if not exists billing_currency text not null default 'ARS',
  add column if not exists timezone text not null default 'America/Argentina/Buenos_Aires';

comment on column public.organizations.billing_currency is
  'Moneda principal de la sede (ISO-4217): ARS, USD, EUR, BRL, MXN, etc.';

comment on column public.organizations.timezone is
  'Zona horaria IANA de la sede: ej. America/Argentina/Buenos_Aires.';
