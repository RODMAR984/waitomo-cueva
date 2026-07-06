# FitEngine marketing landing (Lovable → Vercel)

Sitio público en **fitengine.app**. La app vive en **app.fitengine.app** (proyecto `waitomo-cueva` en la raíz del repo).

## Desarrollo local

```bash
cd landing
npm ci
npm run dev
```

Requiere Node **>= 22.12** (ver `.nvmrc`).

## Deploy en Vercel

1. Crear proyecto Vercel en el mismo repo GitHub.
2. **Root Directory:** `landing`
3. **Framework Preset:** Other
4. Build: `npm run build` (ya en `vercel.json`)
5. Dominios: `fitengine.app`, `www.fitengine.app`
6. En el proyecto **waitomo-cueva** (app): quitar `fitengine.app` y `www` — dejar solo `app.fitengine.app`.

## DNS (Squarespace)

- `fitengine.app` / `www` → registros que indique Vercel para el proyecto landing
- `app` → CNAME `cname.vercel-dns.com` (proyecto app, no tocar)
