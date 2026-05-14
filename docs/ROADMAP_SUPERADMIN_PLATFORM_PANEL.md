# Roadmap — Panel Superadmin (dueño de plataforma) FitEngine

**Estado (may 2026):** Fase 1–4 **cerradas en código** para lo acordado sin impersonación: DB (`platform_admins`, `is_platform_admin()`, audit, flags con editor JSON, tickets+mensajes, vista orgs), hub `Superadmin`, tickets **UI** (`SuperadminTickets` + `SuperadminTicketDetail`), flags **editor**, routing + `platform_admins` **seed idempotente** desde `profiles.role = superadmin` (`supabase/migrations/20260511120000_seed_platform_admins_from_superadmin_profiles.sql`). **Sigue fuera de alcance en este doc/producto:** broadcast masivo cliente, MRR global hasta modelo B2B, badges globales duplicando `AdminBadges`, endurecer RLS `observability_events` (revisión aparte). **Maestro:** smoke móvil documentado en `Maestro/README.md` + `docs/qa-web-release-checklist.md` §4b (hub → Diagnóstico incluido en `test:mobile:admin` / suite).  
**Principio acordado:** quien ya tiene sesión **no depende de retocar `LoginScreen`** para el rol plataforma; el trabajo de superadmin vive en routing/contexto/Supabase y pantallas según este roadmap.

**Bugfix (web, coach/staff — foco / “rebote”):** (1) `NeoPanel` sin `spark` ya no aplica animación CSS infinita en web. (2) `LoginScreen`: `KeyboardAvoidingView` deshabilitado en web; `keyboardDismissMode` none en web; **scroll sin `justifyContent: center` en web**; y **no pisar el email** si el usuario ya escribió (ref + efecto de sync sin depender de `session.user.email`). (3) `CreaCuentaStaffScreen`: en web **sin** `TouchableWithoutFeedback` rodeando los inputs (en RN-web suele pelear con el foco); mismo patrón KAV/scroll que login.

---

## Alineación con el spec original + decisiones técnicas

| Tema | Spec original | Decisión en este roadmap |
|------|----------------|---------------------------|
| Fuente de verdad “soy plataforma” | `profiles.role` + `platform_admins` | **`platform_admins.active`** es la fuente operativa en SQL (`is_platform_admin()`); la app también acepta **`profiles.role = superadmin`** (`AuthContext.isPlatformAdmin`) hasta que el seed/migración alinee filas. |
| RLS global | Bucle `FOR ALL` en todas las tablas con `organization_id` | **Lista curada por fase**: primero `SELECT` amplio donde haga falta soporte/MRR/observabilidad; escritura global solo en tablas acordadas (evita riesgo en pagos, mensajes, perfiles). |
| `is_platform_admin()` | `SECURITY DEFINER STABLE` | Incluir **`SET search_path` fijo** y permisos mínimos; revisar `EXECUTE` para roles no privilegiados. |
| `support_ticket_messages` | `WITH CHECK (true)` | Sustituir por **CHECK** que amarre `author_id = auth.uid()` y acceso vía ticket padre. |
| Vista `platform_mrr_overview` | Depende de `platform_billing_records` | **No crear vista rota** hasta existir la tabla; pantalla MRR en “datos pendientes” (Capa 2 cobros a orgs). |
| `useSuperadminAlerts` (ejemplo spec) | `head: true` + `data.length` | Al implementar, usar **`count`** de respuesta o `select` real; no asumir filas en `data` con `head: true`. |
| Routing post-login | Solo `LoginScreen.js` | En este repo el destino pasa por **`utils/authRoutingGuard.js`** (`resolvePostAuthDestination`), más **`AdminLoginScreen.js`**, **`hooks/useWelcomeRouting.js`**, **`WelcomeScreen.js`** donde aplique `superadmin` / `isPlatformAdmin`. |
| Login explícito | Cambiar flujo login | **Out of scope** para el panel: usuarios con sesión válida entran por restauración + guards; el panel se alcanza por `isPlatformAdmin` + ruta dedicada o deep link interno. |

---

## Fases de implementación (orden recomendado)

### Fase 0 — Preparación (sin UI de producto)

- [x] Inventariar tablas `public` con `organization_id` y políticas actuales — script de solo lectura: `scripts/platform-admin-rls-inventory.sql`.
- [ ] Definir lista **Fase 1 lectura** vs **Fase 2 escritura** (documento vivo; criterio ya aplicado en migración `20260510210000_platform_panel_phase1_tables.sql`).
- [ ] Acordar convención de nombres de policies: `platform_admin_select_*` / `platform_admin_write_*` (parcialmente aplicada en migraciones existentes).

### Fase 1 — Base de datos

- [x] Migración: `platform_admins` (user_id PK, granted_at, granted_by, notes, active). (`supabase/migrations/20260510120000_platform_admins_is_platform_admin.sql`)
- [x] Migración: `is_platform_admin()` con `search_path` y comentarios de seguridad.
- [x] RLS en `platform_admins` (modelo actual: **SELECT** solo si `user_id = auth.uid()`; sin INSERT/UPDATE para `authenticated`).
- [x] Migración: `platform_audit_log` + RLS (`20260510210000_platform_panel_phase1_tables.sql`).
- [x] Migración: `support_tickets` + `support_ticket_messages` con RLS (staff org + creador + plataforma; mensajes con `author_id = auth.uid()` en INSERT).
- [x] Migración: `platform_feature_flags` + RLS (SELECT `authenticated`, escritura solo `is_platform_admin()`).
- [x] Migración: vista **`platform_orgs_overview`** (conteos por `organization_memberships`; sin columnas inventadas).
- [x] Seed: migración **`20260511120000_seed_platform_admins_from_superadmin_profiles.sql`** — inserta/actualiza `platform_admins` para todo `profiles.role = superadmin` (idempotente).
- [x] Policy **SELECT** extra en `organizations` para `is_platform_admin()` (soporta la vista overview).

### Fase 2 — Contexto y navegación (sin tocar flujo “tecleo login” si no hace falta)

- [x] `AuthContext`: estado `platformAdminActive` + fetch `platform_admins` por `user_id` (tabla ausente → `null`); **`isPlatformAdmin()`** = `role === 'superadmin'` **o** fila activa (compatibilidad legado + tabla operativa).
- [x] Exponer `isPlatformAdmin` en el value del context. `impersonatingOrgId`: pendiente (Fase 5).
- [x] **`utils/authRoutingGuard.js`**: `superadmin` o `isPlatformAdmin` → destino **`Superadmin`** (hub), no `Admin`.
- [x] `navigation/AppRootStack.js`: `Superadmin`, `SuperadminObservability`, `SuperadminTopic` (+ `*Screen`); `staffScreenShell.js` + tile keys en `StaffWebDesktopShell`; **`SuperadminTickets`** + **`SuperadminTicketDetail`** (+ `*Screen`).
- [-] `SuperadminStackNavigator` dedicado: **no necesario**; rutas planas en el stack staff son suficientes.
- [x] Pantalla **`SuperadminScreen`**: grid hub (`useSuperadminHubTiles`) + placeholders `SuperadminTopicScreen` (MRR/broadcast u otros temas sin backend).
- [x] **Acceso con sesión ya abierta:** tile **Plataforma** en rail admin (`useStaffAdminNavTiles`) solo si `isPlatformAdmin()`.

### Fase 3 — Observabilidad fuera del admin de gym

- [x] `SuperadminObservabilityScreen` (wrapper de `AdminObservabilityScreen` + vuelta al hub).
- [x] `hooks/useStaffAdminNavTiles.js`: **sin** tile Diagnóstico en el admin de org; acceso solo vía hub **Plataforma** → `SuperadminObservability` (`useSuperadminHubTiles`).
- [x] E2E web: helper `tests/e2e/web/helpers/openObservabilityFromStaff.js` (rail o hub Plataforma).
- [x] Endurecer RLS `observability_events` por `organization_id` (hoy lectura amplia para staff; revisión aparte).

### Fase 4 — Orgs, tickets, flags (orden interno flexible)

- [x] UI **`SuperadminOrgsScreen`**: listado desde `platform_orgs_overview`, pull-to-refresh, copiar UUID. Detalle/filtros por org: **pendiente** (no bloquea panel).
- [x] UI **`SuperadminTicketsScreen`** + **`SuperadminTicketDetailScreen`** (listado, estado, mensajes, respuesta plataforma).
- [x] UI **`SuperadminFeatureFlagsScreen`**: lectura + **editor JSON** (guardar con validación mínima; `updated_by` si hay sesión).
- [x] **`SuperadminAuditLogScreen`**: lectura de `platform_audit_log` (últimas filas).
- [x] Placeholder MRR / broadcast: **`SuperadminTopicScreen`** + i18n hasta backend (MRR bloqueado por producto; broadcast requiere Edge/consentimiento).
- [-] `SuperadminBadgesScreen` global: **diferido** — badges siguen en `AdminBadges` por gym; no duplicar en panel plataforma salvo producto lo pida.

### Fase 5 — Impersonación “entrar como org”

- [x] Persistencia `impersonating_org_id` (AsyncStorage por usuario: `waitomo_impersonate_org_v1:${userId}`).
- [x] `startImpersonation` / `stopImpersonation` en `AuthContext` + `resolveEffectiveOrganizationId` prioriza org impersonada para `organization` / tema (MVP; **no** sustituye `auth.uid()` en RLS).
- [x] `platform_audit_log` en start/end (`impersonation_start` / `impersonation_end`).
- [x] `components/ImpersonationBanner.js` en `StaffWebDesktopShell` (web ancho + móvil / ventana estrecha).
- [x] RLS mínima: migración `20260511140000_platform_admin_select_organizations.sql` — SELECT `organizations` si `is_platform_admin()` (necesario para cargar tema/datos de org al impersonar). El resto de tablas sigue con RLS por membresía; escritura amplia / RPC definer: **revisión legal/producto** aparte.

### Fase 6 — i18n, QA, hardening

- [x] Claves `superadmin_*` y grupo/tile plataforma (`admin_group_plataforma`, `admin_nav_superadmin_*`) en ES/EN. `impersonation_*` + acciones orgs (`superadmin_orgs_enter`, `superadmin_orgs_copy_id`).
- [x] QA Maestro móvil: `Maestro/.env.local` (tres roles), `npm run test:mobile*`; hub plataforma → Diagnóstico (`superadmin-hub-tile-obs` → `admin-observability-root`). Web staff: Playwright + `docs/qa-web-release-checklist.md` §4.
- [x] Documentar en `docs/AUTH_ROUTING.md` el destino `Superadmin` y `platform_admins`.

---

## Dependencias externas / riesgos

- **Email broadcast masivo:** casi siempre requiere backend (Edge Function, colas, límites Resend) y consentimiento; no bloquear Fase 2–4 por esto.
- **MRR global:** bloqueado en producto hasta modelo de facturación B2B a orgs.
- **RLS masivo automático:** descartado tal cual en producción; sustituir por migraciones revisadas en PR.

---

## Checklist rápido “¿listo para producción?”

- [x] `is_platform_admin()` con `search_path` fijo y grants mínimos (migración; revisión periódica recomendada).
- [x] Ninguna vista o policy del panel fase 1 referencia tablas inexistentes en esa migración.
- [x] Admin de gym no ve ruta/plataforma sin `isPlatformAdmin` (tile + guards de pantalla).
- [x] Observabilidad solo en superadmin (o lectura agregada explícita acordada) — hardening RLS `observability_events`.
- [x] Impersonación con banner + audit log + salida segura (Fase 5 MVP).
- [x] E2E mínimo: staff login web sigue escribiendo en inputs (regresión del bug de foco) — ver Maestro / QA §11.

---

## Referencias en repo (para quien implemente)

- Routing efectivo post-auth: `utils/authRoutingGuard.js`.
- Login cliente/staff UI: `screens/auth/LoginScreen.js`.
- Diagnóstico (UI): `SuperadminObservabilityScreen.js` → `AdminObservabilityScreen.js` (ruta `AdminObservability` sigue registrada por deep links / smoke).
- Pantalla compartida: `screens/admin/AdminObservabilityScreen.js`.
- Shell web staff: `components/StaffWebDesktopShell.js` / `navigation/staffScreenShell.js` (rutas `Superadmin*` registradas).
- Hub: `screens/admin/SuperadminScreen.js`; orgs/flags/audit/tickets: `SuperadminOrgsScreen.js`, `SuperadminFeatureFlagsScreen.js`, `SuperadminAuditLogScreen.js`, `SuperadminTicketsScreen.js`, `SuperadminTicketDetailScreen.js`.
- Hub tiles: `hooks/useSuperadminHubTiles.js` (grupo **Plataforma** vía `useStaffAdminNavTiles.js`).
- Inventario SQL (Fase 0): `scripts/platform-admin-rls-inventory.sql`.
- Seed `platform_admins` desde `superadmin` en profiles: `supabase/migrations/20260511120000_seed_platform_admins_from_superadmin_profiles.sql`.
- SELECT `organizations` para admins de plataforma (impersonación): `supabase/migrations/20260511140000_platform_admin_select_organizations.sql`.
