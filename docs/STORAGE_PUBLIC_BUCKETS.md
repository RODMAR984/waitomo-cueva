# Buckets públicos de Storage (roadmap 1c)

## Estado en base de datos

Los buckets `org-logos` y `org-backgrounds` están definidos como **públicos** (`storage.buckets.public = true`) para que la app pueda mostrar logos y fondos con URL estable (CDN-style).

Las políticas `SELECT` en `storage.objects` **no** son globales sobre todo el storage: cada política limita explícitamente por `bucket_id`:

- `Org logos are publicly readable` → `USING (bucket_id = 'org-logos')`
- `Org backgrounds are publicly readable` → `USING (bucket_id = 'org-backgrounds')`

Las rutas de objeto siguen el patrón `{organization_id}/…`, y las políticas de `INSERT`/`UPDATE` restringen a dueños de org (`owner_id = auth.uid()`).

## Listado vs lectura directa

Cualquier cliente que conozca la ruta puede leer el objeto (diseño intencional para assets de marca). Mitigar enumeración masiva:

- No exponer listados públicos desde la app (no usar `list()` anónimo sobre estos buckets).
- Mantener RLS de tablas `organizations` alineada para no filtrar ids de org en otros canales.

## Cambios futuros (si el negocio lo exige)

Si se requiere ocultar URLs públicas por completo, habría que pasar a **bucket privado + signed URLs** o proxy en Edge, con impacto en caché y enlaces compartidos.
