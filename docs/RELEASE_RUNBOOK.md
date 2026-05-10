# Runbook — Release y rollback (Fase 3)

Objetivo: mismo flujo en cada release, con verificación automática y rollback claro sin improvisar.

## 0) Antes de tocar producción

- `npm run release:verify` (smokes + export web + bundle + E2E; requiere Chromium instalado: `npx playwright install chromium`).
- Confirmar que **CI** del PR está en verde (`.github/workflows/ci.yml`).
- Alertas de observabilidad activas (sección 6 de `docs/qa-web-release-checklist.md`).

## 1) Tag de release (opcional pero recomendado)

```bash
git tag -a v1.0.x -m "Release v1.0.x"
git push origin v1.0.x
```

El tag marca el commit exacto que corresponde a builds y a un posible rollback por código.

## 2) Mobile (EAS)

**Preview / interno**

```bash
npm run eas:build:android:preview
```

**Producción / TestFlight**

```bash
npm run eas:build:ios:testflight
npm run eas:submit:ios:testflight
```

En el dashboard de EAS queda el historial de builds: cada artefacto es un candidato a **rollback** (volver a instalar o re-submit de un build anterior aprobado).

### Rollback mobile (rápido)

1. En [Expo — builds del proyecto](https://expo.dev), abrir el **build anterior estable**.
2. **Android**: distribuir de nuevo el APK/AAB anterior o generar build desde el commit del tag anterior.
3. **iOS**: `eas submit` de un **build anterior** ya subido a App Store Connect, o promover la versión anterior en App Store Connect (según tu flujo de revisión).

No hace falta revertir código en el dispositivo del usuario si volvés a publicar un binario anterior.

## 3) Web estática (Expo export)

```bash
npm run qa:web:release
```

El artefacto queda en `dist/`. Subí ese directorio al hosting que uses (mismo procedimiento que siempre).

### Rollback web (rápido)

1. Conservar el **zip o carpeta `dist/`** del último release bueno (o el artefacto de CI).
2. Volver a subir ese `dist/` al hosting.
3. Si usás CDN, invalidar caché solo si el hosting no versiona por hash (los assets de Expo suelen ir con hash en nombre de archivo).

## 4) Supabase (schema / edge)

- Migraciones: `npx supabase db push` (solo desde entorno conectado al proyecto correcto).
- Funciones: `npx supabase functions deploy <nombre>`.

### 4.1) Migraciones que suelen quedar “solo en repo” (directorio + UI de planes)

Después de `git pull`, conviene comparar la carpeta `supabase/migrations/` con el historial del proyecto en el **dashboard de Supabase** (o `npx supabase migration list` si está linkado). Si faltan en remoto, el cliente web no verá el comportamiento aunque el código ya esté desplegado.

Archivos a vigilar en releases recientes:

- `20260209120000_plan_abono_card_highlights.sql` — columnas `card_highlights` en `plans` y `abonos`.
- `20260210120000_public_directory_flagship_orgs.sql` — activa `public_directory_enabled` y términos del directorio para orgs vitrina (Waitomo / Marti tu coach / variantes con “marti” + “coach”).

**Nota:** el MCP de Supabase en Cursor puede estar en **solo lectura**; en ese caso las migraciones se aplican igual con `npx supabase db push` desde tu máquina o con el SQL Editor pegando el contenido del archivo (solo si sabés qué hace el script).

**Comprobación rápida en SQL** (opcional): `select count(*) from organizations where coalesce(public_directory_enabled,false);` — si es `0` y ya deberían listarse gims, falta la migración flagship o el toggle en Gym Config.

Si `npx supabase db push` avisa que hay migraciones locales con **timestamp anterior** a la última migración remota, el CLI pide explícitamente:

```bash
npx supabase db push --include-all
```

Revisá el listado que imprime antes de confirmar (staging primero).

**Alertas de observabilidad** (cron en GitHub → edge `observability-alerts`):

```bash
npx supabase db push
npx supabase functions deploy observability-alerts --no-verify-jwt
```

Secrets de la función (opcional, en el dashboard de Supabase o `npx supabase secrets set`):

- `OBS_ALERT_WEBHOOK_URL` — URL que recibe JSON cuando cambia el estado de una alerta.
- `OBS_ALERT_WEBHOOK_BEARER` — Bearer opcional para el webhook.
- Umbrales opcionales: `OBS_ALERT_WINDOW_MINUTES`, `OBS_ALERT_SILENCE_MINUTES`, `OBS_ALERT_SILENCE_BASELINE_HOURS` (por defecto 168: solo alerta silencio si hubo ingest en ese lookback), `OBS_ALERT_MIN_EVENTS`, `OBS_ALERT_ERROR_RATE_THRESHOLD`, `OBS_ALERT_P95_MS_THRESHOLD`.

En **GitHub → Settings → Secrets and variables → Actions** (workflow `observability-alerts.yml`):

- `SUPABASE_PROJECT_URL` — por ejemplo `https://<ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — service role del mismo proyecto

**E2E en CI** (workflow `ci.yml`, opcional — si faltan, Playwright salta esas suites):

- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` — staff con acceso al panel admin web.
- `E2E_CLIENT_EMAIL` / `E2E_CLIENT_PASSWORD` — usuario cliente real (misma org que staging).

**Desde tu máquina (GitHub CLI, sin pegar secretos en el chat):** con `gh auth login` y el repo ya linkeado:

```bash
gh secret set SUPABASE_PROJECT_URL --body "https://TU_REF.supabase.co"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "PEGAR_AQUI_SERVICE_ROLE_JWT"
gh secret set E2E_ADMIN_EMAIL --body "admin@ejemplo.com"
gh secret set E2E_ADMIN_PASSWORD --body "PEGAR_PASSWORD"
gh secret set E2E_CLIENT_EMAIL --body "cliente@ejemplo.com"
gh secret set E2E_CLIENT_PASSWORD --body "PEGAR_PASSWORD"
```

### Rollback Supabase (solo si aplica)

- **Preferido**: migración nueva que revierta el cambio (forward-only).
- **Evitar** borrar datos en caliente; si hace falta restore desde backup del panel Supabase (procedimiento fuera de este runbook corto).

## 5) Post-release (5 minutos)

- Abrir app web o cliente y: welcome → login → una pantalla crítica.
- Revisar que el workflow **Observability Alerts** sigue verde o que no haya alertas `open` nuevas en `observability_alerts` (panel admin o SQL).

## 6) Checklist mínimo (copiar en el PR de release)

- [ ] `npm run release:verify` OK en local o en CI
- [ ] Tag `v…` pusheado (si usan tags)
- [ ] Build EAS generado y enlazado en notas de release
- [ ] Web: `dist/` publicado / URL verificada
- [ ] Supabase: migraciones y funciones desplegadas si hubo cambios
- [ ] Rollback anotado: “build EAS #… / commit … / dist del …”
