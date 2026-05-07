# Empezar aquí — piloto y QA (orden sugerido)

Guía corta; el detalle está en [`CHECKLIST_PILOTO_OPERACION_Y_HUMO.md`](./CHECKLIST_PILOTO_OPERACION_Y_HUMO.md).

---

## Hoy (en el repo, sin teléfono)

1. **Instalar dependencias** (si hace falta): `npm install`
2. **Preflight automático:** `npm run preflight`  
   - Debe terminar con `OK` (i18n + archivos legales + `app.json`).
3. **Opcional — lint:** `npm run lint:waitomo` (puede modificar archivos con `--fix`).

---

## Backend (Supabase)

1. En el **proyecto correcto** (el que usarán los pilotos), aplicar migraciones pendientes, por ejemplo:  
   `supabase link` → `supabase db push`  
   (o el flujo que usen: SQL manual en Dashboard, etc.).
2. Revisar migraciones de referencia en [`REVISION_FLUJOS_Y_PUBLICACION.md`](./REVISION_FLUJOS_Y_PUBLICACION.md) §0.1.

---

## Build para instalar en el teléfono

1. Tener cuenta [Expo](https://expo.dev) y, si aún no está, `npm install -g eas-cli` y `eas login`.
2. En la raíz del repo: `eas build:configure` (si pide completar proyecto).
3. **Android (rápido para piloto):**  
   `eas build --profile preview --platform android`  
   → APK o link de internal testing según perfil.
4. **iOS:**  
   `eas build --profile preview --platform ios`  
   → TestFlight requiere Apple Developer pagado.

Los perfiles están en **`eas.json`** (`development`, `preview`, `production`).

---

## En el dispositivo (lista de humo)

Seguir **§3** del checklist (flujos H1–H15). Prioridad mínima para trial + chat: **H1–H9** y **H14** si hay staff en el piloto.

---

## Soporte al piloto

- Canal acordado (WhatsApp, mail `soporte@fitengine.app`, etc.).
- Anotar bugs con pasos para reproducir.

---

*Siguiente lectura: [`ROADMAP_MEMO_PRODUCTO_Y_LANZAMIENTO.md`](./ROADMAP_MEMO_PRODUCTO_Y_LANZAMIENTO.md) sección C (cuándo calendarizar la semana piloto).*
