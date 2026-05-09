# Waitomo / FitEngine

## Deploy checklist: Directorio publico + Google Places

Este checklist deja operativo el directorio publico con rating/direccion de Google Places.

### 1) Google Cloud (una sola vez)

1. Abrir el proyecto de GCP que usara la app (por ejemplo `waitomo-training`).
2. Verificar facturacion activa en ese proyecto.
3. Habilitar `Places API` en `APIs y servicios -> Biblioteca`.
4. Crear una `API key` en `APIs y servicios -> Credenciales`.
5. Restringir la key:
   - Restriccion de API: solo `Places API`.
   - Restriccion de aplicacion: sin restriccion (si la key solo se usa en backend Supabase).

### 2) Supabase (CLI)

Desde la raiz del repo:

```powershell
npx supabase secrets set GOOGLE_MAPS_API_KEY=TU_CLAVE
npx supabase db push --include-all
npx supabase functions deploy sync-google-place-summary
npx supabase functions deploy places-autocomplete
```

### 3) Verificacion funcional

1. En app (staff): `GymConfig -> Directorio`.
2. Buscar lugar con autocomplete.
3. Seleccionar sugerencia (carga Place ID).
4. Tocar `Sincronizar reseña con Google`.
5. Confirmar que en `PublicDirectory` aparecen:
   - rating y direccion
   - filtros (Todos / Gimnasios / Coaches)
   - paginacion (scroll)
   - enlace `Abrir en Google Maps`

### 4) Notas legales y links

- Version de aviso legal de directorio: `v2` (reconfirmacion en gyms que venian con v1).
- URLs de terminos/privacidad en `app.json`:
  - `fitengineTermsUrl`: `https://waitomofitengine.com/terminos`
  - `fitenginePrivacyUrl`: `https://waitomofitengine.com/privacidad`
