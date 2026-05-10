# Roadmap post–auditoría externa (FitEngine / waitomo-cueva)

Leyenda: `[x]` hecho en repo · `[~]` parcial / en curso · `[ ]` pendiente

**Estado global (2026-05-09):** cierre operativo del roadmap acordado. El seguimiento de avisos del linter de Supabase vive en `docs/SUPABASE_LINTER_BACKLOG.md` (no bloquea releases de app).

## Alta prioridad (1–5)

| ID | Tarea | Estado |
|----|--------|--------|
| 1a | RLS multi-tenant (políticas reales, migraciones) | [x] |
| 1b | Barrido `organization_id` en flujos sensibles (queries, inserts) | [x] — `docs/ORG_ID_AUDIT_CHECKLIST.md` (tabla de barrido + refuerzos en chat/novedades) |
| 1c | Storage: políticas sin listado amplio en buckets públicos | [x] — políticas acotadas por `bucket_id`; guía en `docs/STORAGE_PUBLIC_BUCKETS.md` |
| 2 | Navegación partida + `App.js` fino (bootstrap / shell / gate) | [x] — `bootstrap/runOnce.js`, `components/AuthGate.js`, `navigation/AppShellContent.js`, `App.js` mínimo |
| 3 | `screens/` por dominio (`admin`, `client`, `auth`) | [x] |
| 4 | Servicios fuera de `utils/` (billing, reservas, …) | [x] — `services/billing/*`, `services/booking/*`, `services/billing/billingRecords.js`; re-export deprecado en `utils/*` donde aplica |
| 5 | Narrativa FitEngine vs Waitomo (reglas + copy) | [x] — regla Cursor + i18n (`home_title`, splash, welcome hero, placeholders gym, fe_setup) + `WelcomeScreen` |

## Segundo turno (6–7)

| ID | Tarea | Estado |
|----|--------|--------|
| 6 | Design system admin denso | [x] — `theme/adminSpec.js` aplicado en pantallas admin densas (Finanzas, Reportes, Retención, Comisiones, Badges, …) |
| 7 | Observabilidad + tests (pagos, webhooks, login, cambio org) | [x] — PagoScreen + Edge + `auth_app_mode_changed` con `organization_id`; E2E cliente incluye marca en home; smokes actualizados |

## Solo si negocio lo pide (8)

| ID | Tarea | Estado |
|----|--------|--------|
| 8 | Admin “solo web” por pantalla | [x] — `navigation/staffScreenShell.js`: en `Platform.OS !== 'web'` se muestra pantalla i18n `staff_web_only_*` (sin panel staff en app nativa) |

## Backlog linter / Supabase (fuera del acuerdo mínimo)

Seguimiento explícito: **`docs/SUPABASE_LINTER_BACKLOG.md`** (vistas `SECURITY DEFINER`, `search_path`, `REVOKE anon` en RPC, leaked password protection, etc.).
