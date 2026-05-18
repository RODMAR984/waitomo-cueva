# Fase 1 — Web en producción + APK Android (preview)

Checklist operativo. **No incluye** App Store ni Google Play Console.

## 1. Web en Vercel (`app.fitengine.app`)

### Qué hace el repo

- `vercel.json` en la raíz: build **`npm run perf:web:export:pwa`** → carpeta **`dist/`** (PWA: `display: standalone`, service worker, metas Apple).
- Push a **`master`** en GitHub despliega automático (proyecto `waitomo-cueva`, equipo `waitomofitengine`).
- Dominios ya vinculados al proyecto (ver panel Vercel): `app.fitengine.app`, `fitengine.app`, etc.

### Supabase

- La app usa las claves en `supabaseClient.js` (proyecto `nfjjkvjsssgxxsuocmhj`). **No hace falta** `EXPO_PUBLIC_SUPABASE_*` en Vercel salvo que más adelante las movamos a env.
- En **Supabase → Authentication → URL Configuration**, deben estar (entre otras):
  - `https://app.fitengine.app`
  - `https://fitengine.app`
  - Redirect: `https://fitengine.app/auth/callback` (y/o el que use OAuth en código).

### Variables opcionales en Vercel (Settings → Environment Variables)

| Variable | Cuándo |
|----------|--------|
| `EXPO_PUBLIC_RUM_ANON_KEY` | Si querés RUM anónimo en prod |
| `NODE_OPTIONS=--max-old-space-size=8192` | Si el build en Vercel se queda sin memoria |

### Después del push

1. En Vercel → Deployments → último deploy **Ready**.
2. Abrir https://app.fitengine.app/site.webmanifest → debe decir **`"display": "standalone"`** (no `browser`).
3. Abrir https://app.fitengine.app → login de prueba.

### Build local (igual que Vercel)

```bash
npm run qa:web:release:pwa
# Artefacto en dist/ — subir manual solo si no usás git deploy
```

---

## 2. PWA en iPhone (Safari)

Para **novia / hermana**:

1. Safari → https://app.fitengine.app
2. Compartir → **Agregar a pantalla de inicio**
3. Abrir desde el ícono (debe ir **sin barra de URL** si el manifest es `standalone`).
4. Probar: crear cuenta, login, calendario, reserva, chat, pago MP.

**Limitación:** en iOS web **no hay push** como app nativa.

---

## 3. APK Android (EAS preview)

### Perfil

`eas.json` → profile **`preview`**: APK (`buildType: apk`), distribución internal.

### Comandos (en tu PC, con cuenta Expo logueada)

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android
```

O desde el repo:

```bash
npm run eas:build:android:preview
```

Al terminar, Expo da un **link HTTPS** al `.apk` → mandarlo por WhatsApp al tester Android.

En el teléfono: permitir **instalar apps desconocidas** → descargar → instalar.

### Validación mínima (vos + tester Android)

- [ ] Instala sin error
- [ ] Abre, login, mismo flujo que web (cliente Waitomo si aplica)
- [ ] Notificaciones push (si están configuradas en el proyecto) — solo en nativo

---

## 4. QA manual antes de pasar links (Ro)

- [ ] https://app.fitengine.app con HTTPS
- [ ] Ícono FitEngine al agregar a inicio (iOS)
- [ ] Crear cuenta / login cliente y staff
- [ ] Panel cliente + calendario + reserva
- [ ] Chat
- [ ] Pago MP (checkout y vuelta)
- [ ] Sin errores graves en consola del navegador

Anotar diferencias **web iPhone** vs **APK Android**.

---

## 5. Qué sigue (Fase 2 — no empezar hasta cerrar Fase 1)

Bug código invitación, welcome 2 botones, textos panel cliente, RLS badges, MP productivo. Ver plan de Ro.

---

## Comandos útiles

| Acción | Comando |
|--------|---------|
| Export PWA local | `npm run perf:web:export:pwa` |
| QA + export PWA | `npm run qa:web:release:pwa` |
| E2E web (usa export normal) | `npm run test:e2e:web` |
| APK preview | `npm run eas:build:android:preview` |
