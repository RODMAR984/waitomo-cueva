# Mapa estelar — estado y operación

Checklist de metas de producto/ingeniería web (FitEngine / Waitomo).

## Rendimiento y calidad web

- [x] Export web (`expo export --platform web`) + post-proceso de branding (`scripts/inject-web-branding.cjs`).
- [x] Lighthouse CI (`lighthouserc.js`, `npm run perf:lhci`). Sin `LHCI_TARGET_URL` mide `dist/`; con el secret mide una URL desplegada.
- [x] Service worker opcional: `ENABLE_WEB_SW=1` + `assets/web-sw.js` → `dist/sw.js` vía `scripts/copy-web-sw-optional.cjs` (encadenado en `perf:web:export`).
- [x] **PWA instalable (opcional):** `npm run perf:web:export:pwa` (`ENABLE_PWA=1`) → manifest `standalone`, `scope` / `id` / `orientation`, iconos 192+512 (+ `maskable`), metas Apple, y SW (mismo `web-sw.js`). Sin esta variable el build sigue en modo `display: "browser"`.
- [x] Core Web Vitals en cliente web (`utils/webVitals.web.js`): carga diferida de `web-vitals`, eventos a observabilidad + cola RUM anónima.

## Observabilidad

- [x] Eventos cliente → `ingest-observability` con flush en `visibilitychange`.
- [x] RUM anónimo: Edge `ingest-rum-anon`, tabla `web_rum_anonymous`, cliente `utils/rumAnonEnqueue.web.js` (`EXPO_PUBLIC_RUM_ANON_KEY` = secreto `RUM_ANON_INGEST_KEY` en la función).

## CI

- [x] Workflow `.github/workflows/ci.yml`: QA web, LHCI (`secrets.LHCI_TARGET_URL` opcional), E2E Playwright.
- [x] Secret opcional de repo **`EXPO_PUBLIC_RUM_ANON_KEY`**: si lo cargás en GitHub → Settings → Secrets and variables → Actions, el `expo export` del CI también puede enviar RUM. Si no está, el job igual pasa.

## Plantilla local

- [x] **`.env.example`** en la raíz: copiar a `.env` y rellenar `EXPO_PUBLIC_RUM_ANON_KEY` (ver comentarios en el archivo).

## Operación Supabase (una vez por proyecto)

1. [x] Migración `20260425120000_web_rum_anonymous.sql` aplicada (SQL Editor o CLI).
2. [x] `npx supabase functions deploy ingest-rum-anon`
3. [x] Secreto `RUM_ANON_INGEST_KEY` en el proyecto (Edge Functions secrets).
4. [ ] **Opcional endurecer:** orígenes permitidos (recomendado en producción):

   ```bash
   npx supabase secrets set RUM_ALLOWED_ORIGINS=https://app.fitengine.app,https://www.fitengine.app,https://fitengine.app
   ```

   Ajustá dominios a los que realmente sirvan la SPA. Lista vacía = en el código actual se aceptan todos los `Origin` (cómodo en dev, más laxo en prod).

## Nube Expo (EAS) — si construís en expo.dev

- [ ] En **expo.dev** → tu proyecto → **Environment variables** (o Secrets): definir **`EXPO_PUBLIC_RUM_ANON_KEY`** con el **mismo** valor que `RUM_ANON_INGEST_KEY`. Sin eso, los builds en la nube no mandan RUM aunque el `.env` local sí.

## Cómo saber si RUM “quedó bien”

1. **Table Editor** → `web_rum_anonymous` → deberían aparecer filas tras usar la web (boot / vitals), o tras un POST manual a la función.
2. **Edge Functions** → `ingest-rum-anon` → **Logs** si ves 401/403/503.

## E2E

- [x] Smoke de shell: `tests/e2e/web/web-shell-health.spec.js`.

## Estado

**Código y pipeline del mapa: cerrados.** Lo único que queda es **config en dashboards** (GitHub secret opcional, variables EAS, y opcional `RUM_ALLOWED_ORIGINS`) según dónde construyas y qué tan estricto quieras el CORS de la función.
