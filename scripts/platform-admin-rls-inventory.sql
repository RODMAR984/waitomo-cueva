-- Fase 0 roadmap: inventario de solo lectura (SQL Editor / psql).
-- No modifica datos.

-- Tablas public con columna organization_id
SELECT table_schema, table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'organization_id'
ORDER BY table_name;

-- Políticas RLS en public (resumen)
SELECT schemaname, tablename, policyname, cmd, roles::text, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
