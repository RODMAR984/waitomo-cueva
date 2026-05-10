# Arquitectura — siguientes pasos (repo waitomo-cueva / FitEngine)

## Hecho reciente (contexto)

- **Pantallas staff/admin** en `screens/admin/` (Admin, GymConfig, finanzas, org members, etc.). `navigation/staffScreenShell.js` y `AdminLogin` en `AppRootStack` importan desde ahí.
- **Pantallas cliente** en `screens/client/` y **onboarding / login** en `screens/auth/` (mismo criterio de imports `../../` hacia la raíz). `navigation/AppRootStack.js`, `NavigationWrapper.js`, smokes y `playwright.global-setup.cjs` apuntan a esas rutas.
- **Stack raíz** en `navigation/AppRootStack.js` (mismos nombres de ruta que antes). `App.js` solo providers + `AppShellContent`; el shell (`NavigationContainer`, `AuthGate`, `AppRootStack`) vive en `navigation/AppShellContent.js`; bootstrap en `bootstrap/runOnce.js`.
- **Directorio público**: datos vía `services/publicDirectory.js` (re-export en `utils/publicDirectory.js` para imports legacy). Pantalla `PublicDirectoryScreen`; tab cliente `Directory` en `ClientTabs` apunta al mismo componente.
- **Smoke tests** `scripts/smoke-routing.cjs` y `scripts/smoke-flows.cjs` leen rutas desde `AppRootStack.js`.

## Próximos pasos seguros (por PRs pequeños)

1. **Más lógica en `services/`** — mantener Supabase y transforms fuera de componentes UI.
2. **RLS**: seguir `docs/MULTI_TENANT_RLS_AUDIT.md`; migración `20260509120000_rls_mercadopago_credentials_badges_revoke_anon_staff_rpc.sql` (credenciales MP, badges, `REVOKE` anon en RPC `staff_*`). Probar en staging antes de producción.
3. **Observabilidad / pagos**: eventos en `screens/client/PagoScreen.js` y logs JSON en Edge `stripe-webhook` / `mercadopago-webhook` (sin PII); ampliar donde haga falta.

## Deploy

- Web estático: `npm run perf:web:export` → `dist/`; ver reglas del proyecto para Vercel y callback OAuth.

## Supabase

- Tras cambios en `supabase/migrations/`, el flujo sano es `npx supabase link` (una vez) y `npx supabase db push` en staging antes de producción.
- Si el asistente no puede aplicar migraciones (MCP read-only), seguí `docs/RELEASE_RUNBOOK.md` sección 4.1.

## E2E web (Playwright)

- `playwright.global-setup.cjs` compara fechas de `dist/index.html` frente a archivos fuente clave y, si hace falta, corre `npm run perf:web:export` antes de levantar `serve` (así no se testea un bundle viejo). Para saltar ese paso en local: `PLAYWRIGHT_SKIP_EXPORT=1`.
