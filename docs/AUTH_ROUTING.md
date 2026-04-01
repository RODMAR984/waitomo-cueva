# Auth, perfiles, memberships y navegación (FitEngine / Waitomo)

Documento para alinear IA y desarrolladores: qué datos manda Supabase, qué lee la app y por qué una cuenta puede ir a **Cliente**, **AdminLite**, **Configura tu espacio** o **Registro inicial**.

## Fuentes de verdad

| Fuente | Uso en routing |
|--------|----------------|
| `auth.users` | Sesión; `user_metadata.role` / `signup_intent` pueden alinear perfil vía `healProfileRoleFromUserMetadata` en `AuthContext`. |
| `public.profiles` | `role`, `organization_id` — leído por REST en `fetchProfile`. |
| `organization_memberships` | `hasStaffMembership`, `hasClientMembership`, dual hat. |
| `organizations` (query por `owner_id`) | Merge en memoria si hay memberships pero falta fila staff; alimenta `ownedOrganizations`. |

## Trampa: `organization_id` en `profiles`

Las migraciones históricas pueden asignar **Waitomo Training** (u otra seed) como `organization_id` por defecto. Eso **no** significa que el usuario haya completado el onboarding de gym en la app (pantalla **Configura tu espacio** / creación de org propia).

**No usar solo** `!profile.organization_id` para decidir si ir a **Configura tu espacio**.

## Criterio “tengo mi gym en el sistema”

En `AuthContext`, `ownedOrganizations` agrupa orgs donde el usuario tiene rol staff (memberships) **y** hace merge de filas `organizations` con `owner_id = auth.uid()` cuando aún no hay membership staff (registro a medias).

- **`ownedOrganizations.length === 0`** + rol `coach` / `admin` → primero **Configura tu espacio**, no AdminLite.
- Con al menos una org en contexto → **AdminLite** (o flujo staff dual según modo).

## Archivos tocados recientemente

- `screens/LoginScreen.js` — `navigateByRole`: coach/admin esperan `authNavigationReady`; sin orgs propias en contexto → ConfiguraTuEspacio; carrera OAuth→RegistroInicial mitigada con `initialProfileSyncDone`.
- `screens/WelcomeGlobalScreen.js` — mismo criterio antes de mandar coach/admin a AdminLite.
- `screens/RegistroOwnerScreen.js` — `signUp` con `data: { role: 'coach', signup_intent: 'gym_owner' }` para el trigger `handle_new_user`.
- `contexts/AuthContext.js` — sync memberships + merge owner; `healProfileRoleFromUserMetadata`; logs `ROUTING_DEBUG` (opcional quitar en producción).

## Registro gym (alta)

1. Usuario elige crear gym/coach → `RegistroOwnerScreen` → `signUp` con metadata de rol.
2. Trigger crea `profiles` con rol acorde (coach si metadata lo indica).
3. **Configura tu espacio** crea la fila en `organizations`, actualiza `profiles`, hace upsert de memberships.

## Cuentas legacy

Perfiles creados solo como `cliente` hasta completar paso 3: corregir con SQL (`UPDATE profiles SET role = 'coach' …`) o metadata en Auth + heal en app.
