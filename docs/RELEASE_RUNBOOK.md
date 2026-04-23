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

**Alertas de observabilidad** (cron en GitHub → edge `observability-alerts`):

```bash
npx supabase db push
npx supabase functions deploy observability-alerts --no-verify-jwt
```

Secrets de la función (opcional, en el dashboard de Supabase o `npx supabase secrets set`):

- `OBS_ALERT_WEBHOOK_URL` — URL que recibe JSON cuando cambia el estado de una alerta.
- `OBS_ALERT_WEBHOOK_BEARER` — Bearer opcional para el webhook.
- Umbrales opcionales: `OBS_ALERT_WINDOW_MINUTES`, `OBS_ALERT_SILENCE_MINUTES`, `OBS_ALERT_MIN_EVENTS`, `OBS_ALERT_ERROR_RATE_THRESHOLD`, `OBS_ALERT_P95_MS_THRESHOLD`.

En **GitHub → Settings → Secrets and variables → Actions** (workflow `observability-alerts.yml`):

- `SUPABASE_PROJECT_URL` — por ejemplo `https://<ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — service role del mismo proyecto

**Desde tu máquina (GitHub CLI, sin pegar secretos en el chat):** con `gh auth login` y el repo ya linkeado:

```bash
gh secret set SUPABASE_PROJECT_URL --body "https://TU_REF.supabase.co"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "PEGAR_AQUI_SERVICE_ROLE_JWT"
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
