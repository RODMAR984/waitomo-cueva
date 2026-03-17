-- =============================================================================
-- PERFILES: permitir leer nombres de otros para el chat
-- =============================================================================
-- Sin esto, en el chat solo ves tu nombre; el resto aparece como "Miembro"
-- porque RLS suele permitir solo "leer mi propia fila" (id = auth.uid()).
-- El chat puede tener varios del plan + coach + admin; todos necesitan ver
-- full_name (o username) del resto para las burbujas.
-- Ejecutá en Supabase: SQL Editor → New query → Pegar → Run
-- =============================================================================

CREATE POLICY "Authenticated can read profiles for display"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Si da error "policy already exists", quitá la política anterior que restringe
-- SELECT a solo tu fila o renombrá esta. Con esta política, cualquier
-- autenticado puede leer id, full_name, username de todos (solo para mostrar en chat).
