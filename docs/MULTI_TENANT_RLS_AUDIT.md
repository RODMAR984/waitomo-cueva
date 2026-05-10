# Auditoría RLS multi-tenant (checklist)

Documento operativo para revisar políticas antes de tocar datos sensibles o exponer listados públicos. No sustituye una revisión SQL completa en Supabase.

## Principios

- **Tenant = `organization_id`** en tablas de negocio. Las políticas deben restringir lectura/escritura al org del usuario (miembro activo / rol staff).
- **Listados públicos** solo vía RPC o vistas explícitas con columnas no sensibles; nunca confiar en “anon puede leer organizations” salvo campos pensados para marketing.

## Directorio público

- Columna `organizations.public_directory_enabled` (default `false` desde migración `20260208120000_public_directory_google_places.sql`).
- La RPC `list_public_organizations_directory` debe filtrar `public_directory_enabled = true` (y org activa). Orgs históricas sin pasar por Gym Config no aparecen hasta activar el flag o aplicar la migración de datos `20260210120000_public_directory_flagship_orgs.sql` (solo nombres acordados).
- **Términos**: `features.public_directory_terms_v1` + `features.public_directory_terms_doc_version` alineados con `GymConfigScreen` (`v2`). La migración flagship fusiona esas claves para no dejar la UI en estado inconsistente.
- **Verificación SQL** (solo lectura): `select count(*) from public.organizations where coalesce(public_directory_enabled, false) = true;` — si el resultado es `0` en producción y esperás ver vitrinas, revisá que la migración flagship esté aplicada y que los `name` matcheen el `WHERE` del SQL (nombres de prueba tipo “Marti hot” sin la palabra “coach” no entran en el patrón `marti` + `coach`).

## Revisión periódica (orden sugerido)

1. `pg_policies` / editor Supabase: tablas con PII (perfiles, mensajes, pagos, invitaciones).
2. Comprobar que **service role** no se use en el cliente; solo Edge Functions con secretos.
3. Tras cada migración que añada tablas: políticas por defecto + tests manuales con usuario de otro org.
4. RPC `SECURITY DEFINER`: documentar quién puede ejecutarlas y qué columnas devuelven.

## Referencias en repo

- `utils/authRoutingGuard.js`, `hooks/useWelcomeRouting.js` — enrutado post-login (no RLS, pero evita fugas de flujo).
- `services/publicDirectory.js` — llamada a la RPC del directorio.

## Hallazgos Supabase Database Linter (seguridad)

Ejecutar periódicamente **Database Advisor → Security** en el dashboard o vía MCP `get_advisors` (`type: security`). Referencia general: [Database Linter](https://supabase.com/docs/guides/database/database-linter).

### Corregido en migración `20260509120000_rls_mercadopago_credentials_badges_revoke_anon_staff_rpc.sql`

| Tema | Acción |
|------|--------|
| `mercadopago_org_credentials` — RLS sin políticas (lint `0008`) | Políticas explícitas **deny** para `authenticated` y `anon` (acceso solo `service_role` / Edge, igual que la intención documentada en `20260505210000_mercadopago_org_oauth.sql`). |
| `badge_definitions` — RLS desactivado en `public` (lint `0013`) | `ENABLE ROW LEVEL SECURITY` + política `SELECT` para `authenticated` (catálogo de badges). |
| RPC `public.staff_*` — `anon` puede ejecutar `SECURITY DEFINER` (lint `0028`) | `REVOKE EXECUTE … FROM anon` en bucle sobre funciones cuyo nombre empieza con `staff_`. El cliente staff usa JWT `authenticated`; el vector era llamadas sin sesión. |

### Pendientes de gobernanza (no bloquean el merge; planificar)

- **Vistas `SECURITY DEFINER`** (`medical_status_current`, `current_subscription`): revisar si deben pasar a `SECURITY INVOKER` o consumirse solo desde RPC con columnas acotadas. [lint 0010](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- **Funciones con `search_path` mutable** (`is_admin_like`, triggers `set_updated_at`, etc.): fijar `SET search_path = public` (o `pg_temp, public`) en el cuerpo / definición. [lint 0011](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- **Otras RPC `SECURITY DEFINER` ejecutables por `anon`**: el linter lista muchas además de `staff_*`; muchas son flujos públicos deliberados (p. ej. `list_public_organizations_directory`, reservas). Tratar cada una: `REVOKE` de `anon` solo donde el negocio exija sesión, o validar `auth.uid()` dentro y tests de abuso.
- **Buckets storage** (`avatars`, `org-logos`, `org-backgrounds`) — política `SELECT` amplia en bucket público: [lint 0025](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing)
- **Auth**: activar *leaked password protection* en Auth si aún no está. [docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
