# Checklist: `organization_id` en flujos sensibles

Objetivo: toda lectura/escritura multi-tenant debe quedar acotada por org del usuario (o por RPC que ya valida membresía).

## Cómo auditar (manual o en PR)

1. Buscar `.from('tabla'` en `screens/`, `contexts/`, `hooks/`, `utils/`, `services/` (no en `supabase/migrations/`).
2. Para tablas con PII o dinero (`profiles`, `gym_news`, `class_bookings`, `finanzas_ledger`, `billing_payments`, `chat_messages`, …): confirmar `.eq('organization_id', …)` o política RLS que restrinja por membership.
3. Probar con dos cuentas de **orgs distintas** en staging: no debe verse data cruzada.

## Comandos útiles (repo)

```bash
rg "\.from\(['\"]" --glob "*.js" screens contexts hooks utils services
```

## Hallazgos fijos en código (2026-05-09)

- **`ChatCanalesScreen`:** si no hay `orgId`, no se consulta `chat_channels` (antes el `.eq` era opcional).
- **`AdminNovedadesScreen`:** `gym_news` siempre con `.eq('organization_id', orgId)`; sin org no hay query.
- **Reservas / trial:** `services/booking/*` — RPC con `p_organization_id`; ver nota histórica abajo.

## Barrido por área (OK / notas)

| Área | Patrón | Notas |
|------|--------|--------|
| `AuthContext` | org + memberships | Fuente de verdad `organization`, `resolveEffectiveOrganizationId`, refresh membresías. |
| `TrainingDataContext` | `finanzas_*` | Filas ligadas a `owner_id` / contexto staff; revisar RLS en DB al cambiar modelo. |
| Admin `*Screen` | `orgId` + `.eq('organization_id', orgId)` | Finanzas, comisiones, abonos, planes, resumen, etc. usan org del `useAuth`. |
| `ClientScreen` | chat / bookings | Queries usan `orgChat` / org efectiva donde aplica; revisar al añadir queries nuevas. |
| `CalendarioScreen` | plans, slots, bookings | Filtros por org del plan contexto; RPC de reserva en `services/booking`. |
| `ChatScreen` / canales | `chat_channels`, `chat_messages` | Canales acotados por org en carga; RLS refuerza en servidor. |
| `AdminBadgesScreen` | `badge_definitions` | Catálogo global seed; mutación vía RPC `staff_refresh_badges_for_org` con `p_org_id`. |
| `PlanChatScreen` | `chat` | Legacy tabla `chat`; validar RLS si sigue en uso. |
| `JoinWithInviteCodeScreen` | `profiles` | Post-invite; org viene del flujo de invitación. |
| `PagoScreen` | `user_abonos`, `user_plans` | Con `userId` / contexto sesión; billing también en `services/billing/billingRecords.js`. |

## Histórico

- **Reservas / clase de prueba:** `services/booking/classBooking.js` y `services/booking/trialClassGrant.js` delegan en RPC con `p_organization_id`; lecturas a `trial_class_grants` filtran por `user_id` + `status`.
