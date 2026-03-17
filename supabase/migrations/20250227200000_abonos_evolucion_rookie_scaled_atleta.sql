-- =============================================================================
-- Abonos para Ciclo Evolución (planes personalizados): Rookie, Scaled, Atleta
-- Frecuencia: Rookie 1-2 días/sem, Scaled 3-4, Atleta 5-6. Precios estimativos.
-- =============================================================================
-- Ejecutar en Supabase: SQL Editor → New query → Pegar → Run
-- Si la tabla public.abonos no existe, crearla antes con las columnas que usa la app.
-- =============================================================================

-- Crear tabla abonos si no existe (columnas usadas por AbonosPasesScreen / PagoScreen)
CREATE TABLE IF NOT EXISTS public.abonos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL,
  name text NOT NULL,
  duration_days integer,
  included_sessions integer,
  price_cents integer,
  currency text NOT NULL DEFAULT 'ARS',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para listar por plan
CREATE INDEX IF NOT EXISTS idx_abonos_plan_active
ON public.abonos (plan_id, is_active)
WHERE is_active = true;

-- Política: lectura pública para que la app muestre abonos (sin login aún)
ALTER TABLE public.abonos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Abonos public read" ON public.abonos;
CREATE POLICY "Abonos public read"
ON public.abonos FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Borrar abonos previos de evolución para no duplicar (opcional; comentar si querés conservarlos)
-- DELETE FROM public.abonos WHERE plan_id = 'evolucion';

-- Insertar los tres niveles de Ciclo Evolución (precios estimativos; ajustá a tu tarifa)
INSERT INTO public.abonos (plan_id, name, duration_days, included_sessions, price_cents, currency, is_active)
VALUES
  ('evolucion', 'Rookie (1-2 días/sem)', 30, NULL, 25000, 'ARS', true),
  ('evolucion', 'Scaled (3-4 días/sem)', 30, NULL, 35000, 'ARS', true),
  ('evolucion', 'Atleta (5-6 días/sem)', 30, NULL, 45000, 'ARS', true);
