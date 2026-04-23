# Oleadas producto (5.x) — documento a seguir (“hueso”)

**Relación:** memo piloto general en [`ROADMAP_MEMO_PRODUCTO_Y_LANZAMIENTO.md`](./ROADMAP_MEMO_PRODUCTO_Y_LANZAMIENTO.md); integraciones en [`INTEGRACIONES_ANALYTICS_EXPORT.md`](./INTEGRACIONES_ANALYTICS_EXPORT.md).

---

## Estado en repo (código + migraciones)

| # | Entrega | Qué incluye | Repo |
|---|---------|-------------|------|
| **5.1** | Freeze | DB + RPC + GymConfig + Admin congelar + detalle socio | `20260424210000_membership_freeze_org_rpc.sql` + pantallas ya enlazadas |
| **5.3** | Reportes (4 cards) | RPC `staff_org_dashboard_metrics` + **Admin → Reportes** | `20260424220000_…sql` + `AdminReportesScreen.js` |
| **5.2** | Retención (v1) | Dormant + nudge **in-app** (límite 7 días) + mensaje en **ClientScreen** | Misma migración + `AdminRetentionScreen.js` + `mark_in_app_nudge_read` |
| **5.4** | Comisiones | Tabla `coach_plan_commissions` + **Admin → Comisiones** | Misma migración + `AdminCommissionsScreen.js` |
| **5.5** | Stripe capa 1 (prep) | Columnas org + **Admin → Stripe** (dueño/superadmin) | Misma migración + `AdminStripeSettingsScreen.js`; checkout/webhook en Edge (ver doc integraciones) |
| **5.6–5.8** | Export / analytics | **CSV miembros** en OrgMembers; GA/Zapier documentados | `OrgMembersScreen.js` + `INTEGRACIONES_ANALYTICS_EXPORT.md` |
| **5.9** | Badges | Definiciones seed + `user_badges` + RPC recalc + **Admin → Badges** | Misma migración + `AdminBadgesScreen.js` |

**Operación pendiente (siempre):** aplicar migraciones en el proyecto Supabase y QA E2E por sede.

---

## Oleada A

### 5.1 Freeze — acotado (DB + RPC + UI admin)

Ver migración `20260424210000_membership_freeze_org_rpc.sql`.

### 5.3 Reportes — 4 cards, queries simples

Métricas: clientes activos (memberships cliente), reservas programadas próximos 7 días, abonos activos, asistencias `completed_attended` últimos 30 días.

---

## Oleada B

### 5.2 Retención

v1 sin proveedor de email: listado + nudge in-app con anti-spam (7 días). Email masivo cuando exista SMTP/Resend en Edge.

---

## Oleada C

### 5.4 Comisiones

Por coach y `plan_key`, comisión en **basis points** (100 = 1%).

---

## Oleada D

### 5.5 Stripe

Persistencia de cuenta Connect + flag; cobros y webhooks en servidor.

### 5.6–5.8

Export CSV en app; GA/Zapier según doc de integraciones.

---

## Oleada E

### 5.9 Badges

Tres hitos por conteo de clases asistidas; botón “Recalcular premios” en admin.

---

## Regla de seguimiento

1. Orden de valor: **5.1 → 5.3 → 5.2 → 5.4 / 5.5 / 5.9** (pueden probarse en paralelo una vez migrado).
2. Cerrar en prod = migración + prueba manual mínima por feature.
3. Web paralelo: alinear por **git** (misma migración y mismos nombres de RPC).
