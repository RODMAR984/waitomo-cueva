# Supabase linter / hardening (seguimiento)

Items que el advisor de Supabase puede marcar y que conviene revisar en cada release de esquema o en auditoría de seguridad.

## Vistas `SECURITY DEFINER`

- Revisar cada vista con `SECURITY DEFINER`: que el `search_path` esté fijado y que el conjunto de filas expuesto sea el mínimo necesario.
- Preferir `SECURITY INVOKER` cuando la vista no requiera privilegios elevados.

## Funciones y `search_path`

- En funciones PL/pgSQL, establecer `SET search_path = public` (o el esquema previsto) al inicio del cuerpo, o declarar la función con `SET search_path FROM CURRENT` según política del proyecto.

## `REVOKE` sobre `anon` / `authenticated`

- RPC que solo deben usar staff: confirmar `REVOKE EXECUTE ON FUNCTION … FROM anon` (y a veces de `authenticated` si solo se invoca con `service_role` o con claims específicos).
- Mantener coherente con la matriz de roles en `docs/ORG_ID_AUDIT_CHECKLIST.md`.

## Auth: leaked password protection

- En Supabase Dashboard → Authentication → Policies: habilitar protección contra contraseñas filtradas (Have I Been Pwned u opción equivalente del proveedor).

## Auth: otras recomendaciones del dashboard

- MFA / rate limits / plantillas de correo: revisar según riesgo del tenant.

Este archivo no sustituye la revisión en Supabase CLI o Dashboard; documenta el alcance acordado en el roadmap post–auditoría.
