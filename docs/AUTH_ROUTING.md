# Auth, perfiles, memberships y navegación (FitEngine / Waitomo)

Documento para alinear IA y desarrolladores: qué datos manda Supabase, qué lee la app y por qué una cuenta puede ir a **Cliente**, **AdminLite**, **Configura tu espacio** o **Registro inicial**.

## Fuentes de verdad

| Fuente | Uso en routing |
|--------|----------------|
| `auth.users` | Sesión; `user_metadata.role` / `signup_intent` pueden alinear perfil vía `healProfileRoleFromUserMetadata` en `AuthContext`. |
| `public.profiles` | `role`, `organization_id` — leído por REST en `fetchProfile`. |
| `organization_memberships` | `hasStaffMembership`, `hasClientMembership`, dual hat. |
| `organizations` (query por `owner_id`) | Merge en memoria si hay memberships pero falta fila staff; alimenta `ownedOrganizations`. |
| `public.platform_admins` | `active = true` para el `user_id` de la sesión → `AuthContext.isPlatformAdmin()` (junto con legado `profiles.role = superadmin`). No sustituye el routing inicial a **AdminLite**; el panel se abre por menú lateral **Plataforma** o navegación a la ruta `Superadmin` / `SuperadminScreen`. |

## Panel plataforma (`Superadmin`)

- **Guard en app:** `isPlatformAdmin()` en `AuthContext` — verdadero si `role === 'superadmin'` **o** hay fila `platform_admins` con `active` para `auth.uid()`.
- **Post-auth (rol `superadmin`):** `resolvePostAuthDestination` / `resolveStaffDestination` y `useWelcomeRouting` envían a **`Superadmin`** (hub plataforma), no a la ruta legacy `Admin`.
- **Rutas:** `navigation/AppRootStack.js` y shell staff (`staffScreenShell.js`, `StaffWebDesktopShell.js`). Detalle: `docs/ROADMAP_SUPERADMIN_PLATFORM_PANEL.md`.

## Trampa: `organization_id` en `profiles`

Las migraciones históricas pueden asignar **Waitomo Training** (u otra seed) como `organization_id` por defecto. Eso **no** significa que el usuario haya completado el onboarding de gym en la app (pantalla **Configura tu espacio** / creación de org propia).

**No usar solo** `!profile.organization_id` para decidir si ir a **Configura tu espacio**.

## Criterio “tengo mi gym en el sistema”

En `AuthContext`, `ownedOrganizations` agrupa orgs donde el usuario tiene rol staff (memberships) **y** hace merge de filas `organizations` con `owner_id = auth.uid()` cuando aún no hay membership staff (registro a medias).

- **`ownedOrganizations.length === 0`** + rol `coach` / `admin` → primero **Configura tu espacio**, no AdminLite.
- Con al menos una org en contexto → **AdminLite** (o flujo staff dual según modo).

## Archivos tocados recientemente

- `screens/LoginScreen.js` — `navigateByRole`: coach/admin; `needsFitEngineSpaceSetup` solo si no hay membresía staff ni org propia (ver `AuthContext`); esperan `authNavigationReady`; carrera OAuth→RegistroInicial mitigada con `initialProfileSyncDone`.
- `screens/WelcomeGlobalScreen.js` — mismo criterio antes de mandar coach/admin a AdminLite; en web no auto-`onContinue` sin `profile.id` (evita salto a registro con sesión huérfana).
- `screens/RegistroOwnerScreen.js` — `signUp` con `data: { role: 'coach', signup_intent: 'gym_owner' }` para el trigger `handle_new_user`.
- `contexts/AuthContext.js` — `restore()`: tras `getSession()`, **`getUser()`** valida contra Auth en servidor; si borraste el usuario en el dashboard, se hace **signOut local** y volvés a invitado (Welcome). Tope **~2.6s** para `authSessionRestored`; watchdog bootstrap **7s**; sync memberships + merge owner; `healProfileRoleFromUserMetadata`; `platform_admins`; logs `ROUTING_DEBUG`.

## Regla de trabajo (regresiones / IA)

- Regla Cursor (solicitable): `.cursor/rules/auth-welcome-routing-safety.mdc` — checklist antes de tocar splash, welcome, `useWelcomeRouting`, `clientPostAuthRoute`, `authRoutingGuard` o sync en `AuthContext`.
- Trazado opt-in: en `.env`, `EXPO_PUBLIC_AUTH_TRACE=1` activa `utils/authTrace.js` (Splash → WelcomeGlobal, web auto-`onContinue`, `navigateToDestination` y rutas sensibles como `RegistroInicial`). Sin `=1`, no se añade ruido en consola.

## Registro gym (alta)

1. Usuario elige crear gym/coach → `RegistroOwnerScreen` → `signUp` con metadata de rol.
2. Trigger crea `profiles` con rol acorde (coach si metadata lo indica).
3. **Configura tu espacio** crea la fila en `organizations`, actualiza `profiles`, hace upsert de memberships.

## Cuentas legacy

Perfiles creados solo como `cliente` hasta completar paso 3: corregir con SQL (`UPDATE profiles SET role = 'coach' …`) o metadata en Auth + heal en app.
