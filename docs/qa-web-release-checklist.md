# QA Web Release Checklist

Checklist operativo para validar release web con foco en estabilidad, i18n, tema y performance.

## 1) Preflight técnico

- Ejecutar:
  - `npm run qa:release`
- Debe terminar sin errores.

## 2) Export web + presupuesto de bundle

- Ejecutar:
  - `npm run perf:web:export`
  - `npm run perf:web:bundle-check`
- Tras el export, `scripts/inject-web-branding.cjs` copia el icono de app (`assets/app-icon-composite.png`, fallback `favicon.png` / `icon.png`) a `dist/`, añade **favicon / apple-touch-icon / theme-color** y un **`site.webmanifest` con `display: "browser"`**. Si falta el composite: `npm run icons:build`.
- Objetivo:
  - Mantener el bundle principal web bajo presupuesto.
  - Valores por defecto:
    - `WARN`: 2.6 MB
    - `FAIL`: 3.0 MB
- Opcional (CI o local):
  - `WEB_BUNDLE_WARN_MB=2.4 WEB_BUNDLE_FAIL_MB=2.8 npm run perf:web:bundle-check`

## 3) Smoke funcional web (manual rápido)

- Login y navegación base:
  - Welcome -> Login -> destino correcto por rol.
- Cliente:
  - Panel, Calendario, Perfil.
  - Reservar/cancelar clase (si aplica).
- Admin:
  - `AdminScreen` render desktop correcto.
  - Crear/editar bloque.
  - `AdminResumen`: expansión de slots, acciones staff.
  - `AdminPlanes`: alta/edición, slots semanales.
- i18n:
  - Verificar textos en ES/EN en pantallas críticas.
- Tema:
  - Verificar claro/oscuro en pantallas críticas.

## 4) E2E automatizado (Playwright)

### Playwright en modo headed (ventana visible)

- Con `npm run test:e2e:web:headed`, Playwright detecta `--headed` y:
  - usa **un solo worker** y desactiva `fullyParallel` (menos ventanas concurrentes),
  - arranca Chromium con **`--start-maximized`** y `viewport: null` para que el layout siga el tamaño real de la ventana.
- Cada test sigue usando un **contexto nuevo** (comportamiento normal de Playwright): vas a ver ventanas que se abren y cierran en secuencia. Para el día a día, el gate estable es **`npm run test:e2e:web`** (headless).

### Google OAuth (login con Google)

- **No hay E2E automatizado** de Google: anti-bot de Google + popups lo hacen poco fiable en Playwright.
- El mensaje **“This browser or app may not be secure”** en automatización **no implica** que usuarios con Chrome/Edge/Safari normales no puedan usar “Continuar con Google”.
- Validación: **smoke manual** en la sección 3 (Welcome → Login → Continuar con Google en navegador real).

- **Un solo programa para ver casi todo el flujo web en pantalla (recomendado):**
  - `npm run test:e2e:web:journey-headed`
  - Archivo único: `tests/e2e/web/full-web-journey.spec.js` (Welcome → público → login → cliente opcional → staff en segunda pestaña opcional).
  - Credenciales opcionales (misma ventana PowerShell): `E2E_CLIENT_*`, `E2E_ADMIN_*` (sin ellas solo corre la parte pública + pantallas de login).
- **Primera vez:** `npx playwright install chromium` (una sola vez por máquina).
- **Variables (PowerShell en Windows):** en la misma ventana donde corrés los tests (no las pegues en el chat):

```powershell
cd C:\Users\marla\waitomo-cueva
$env:E2E_CLIENT_EMAIL = "cliente@tu-staging.com"
$env:E2E_CLIENT_PASSWORD = "tu_password"
$env:E2E_ADMIN_EMAIL = "staff@tu-staging.com"
$env:E2E_ADMIN_PASSWORD = "tu_password"
npm run test:e2e:web
```

- **Solo tests públicos / sin credenciales:** omití las líneas `$env:E2E_*`; las suites cliente y admin se marcan como *skipped*.
- **Ver el navegador:** `npm run test:e2e:web:headed`
- **Saltar re-export si `dist/` ya está fresco:** `$env:PLAYWRIGHT_SKIP_EXPORT = "1"` antes de `npx playwright test …`.

## 4b) Maestro — smoke móvil (Android / iOS, opcional)

- No sustituye Playwright web; valida **binario nativo** instalado en emulador o dispositivo (`npx expo run:android` / `run:ios`).
- Credenciales: **`Maestro/.env.local`** (plantilla `Maestro/.env.example`) — tres pares para la suite completa (`MAESTRO_CLIENT_*`, `MAESTRO_ORG_ADMIN_*`, `MAESTRO_ADMIN_*`).
- Comandos: `npm run test:mobile` (suite), o `test:mobile:client` / `test:mobile:org-admin` / `test:mobile:admin` por rol. Detalle: **`Maestro/README.md`**.

- Ejecutar (equivale a export web + Playwright):
  - `npm run test:e2e:web`
- Incluye:
  - smoke público (welcome/login/registro).
  - smoke admin autenticado **si** están definidas credenciales:
    - `E2E_ADMIN_EMAIL`
    - `E2E_ADMIN_PASSWORD`
- smoke cliente autenticado **si** están definidas credenciales:
    - `E2E_CLIENT_EMAIL`
    - `E2E_CLIENT_PASSWORD`
- Sin credenciales admin, la suite admin se salta automáticamente.
- Sin credenciales cliente, la suite cliente se salta automáticamente.

## 5) Criterio de salida

Se considera release web lista cuando:

- `qa:release` OK
- export web OK
- bundle-check sin FAIL
- smoke funcional sin regresiones críticas

## 5b) Verificación completa pre-release (Fase 3)

- Ejecutar `npm run release:verify` (incluye `qa:web:release` + Playwright; antes: `npx playwright install chromium`).
- Runbook de tag, EAS, web, Supabase y rollback: **`docs/RELEASE_RUNBOOK.md`**.

## 5c) RUM anónimo (web)

- **Local:** `.env` con `EXPO_PUBLIC_RUM_ANON_KEY` (plantilla: `.env.example`). No commitear `.env`.
- **CI (GitHub Actions):** secret de repo opcional `EXPO_PUBLIC_RUM_ANON_KEY` (mismo valor que `RUM_ANON_INGEST_KEY` en Supabase). Sin él el export en CI igual pasa; solo no envía RUM desde ese artefacto.
- **EAS (build en la nube):** definir la misma variable en **expo.dev** → Environment variables / Secrets del proyecto.
- **Producción Supabase (opcional):** `RUM_ALLOWED_ORIGINS` con los HTTPS de la SPA (coma-separados). Detalle: **`docs/MAPA_ESTELAR_COMPLETO.md`**.

## 6) Alertas automáticas (sin observación manual)

- Workflow programado:
  - `.github/workflows/observability-alerts.yml` (cada 5 minutos).
- Función backend:
  - `supabase/functions/observability-alerts`.
- Umbrales iniciales:
  - `error_rate` >= `0.12` en ventana de `15m` (mínimo `30` eventos).
  - `latency_p95_ms` >= `3000ms` en ventana de `15m`.
  - silencio de ingest si no hay eventos en `20m`.
- Requisitos de secretos en GitHub:
  - `SUPABASE_PROJECT_URL` (ej: `https://<project-ref>.supabase.co`)
  - `SUPABASE_SERVICE_ROLE_KEY`
- Opcional para notificación externa (webhook):
  - `OBS_ALERT_WEBHOOK_URL` (env de Supabase Function)
  - `OBS_ALERT_WEBHOOK_BEARER` (env de Supabase Function)

