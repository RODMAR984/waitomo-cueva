-- =============================================================================
-- Finanzas: libro diario (ledger) y caja inicial por día
-- Para sync con la app y para recibir cobros vía webhook (ej. Mercado Pago)
-- =============================================================================
-- Ejecutar en Supabase: SQL Editor → New query → Pegar → Run
-- =============================================================================

-- 1) Libro diario (movimientos de caja)
CREATE TABLE IF NOT EXISTS public.finanzas_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  metodo text NOT NULL DEFAULT 'efectivo',
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'ARS',
  notas text DEFAULT '',
  fuente text,
  link_id text,
  external_id text,
  fecha timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text DEFAULT 'app'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finanzas_ledger_external_id
ON public.finanzas_ledger (owner_id, external_id)
WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finanzas_ledger_owner_fecha
ON public.finanzas_ledger (owner_id, fecha DESC);

ALTER TABLE public.finanzas_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own ledger" ON public.finanzas_ledger;
CREATE POLICY "Users manage own ledger"
ON public.finanzas_ledger
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Service role can insert ledger" ON public.finanzas_ledger;
CREATE POLICY "Service role can insert ledger"
ON public.finanzas_ledger
FOR INSERT
TO service_role
WITH CHECK (true);


-- 2) Caja inicial por fecha (apertura del día)
CREATE TABLE IF NOT EXISTS public.finanzas_caja_inicial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, date)
);

CREATE INDEX IF NOT EXISTS idx_finanzas_caja_inicial_owner_date
ON public.finanzas_caja_inicial (owner_id, date DESC);

ALTER TABLE public.finanzas_caja_inicial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own caja inicial" ON public.finanzas_caja_inicial;
CREATE POLICY "Users manage own caja inicial"
ON public.finanzas_caja_inicial
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Service role can insert caja_inicial" ON public.finanzas_caja_inicial;
CREATE POLICY "Service role can insert caja_inicial"
ON public.finanzas_caja_inicial
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update caja_inicial" ON public.finanzas_caja_inicial;
CREATE POLICY "Service role can update caja_inicial"
ON public.finanzas_caja_inicial
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);
