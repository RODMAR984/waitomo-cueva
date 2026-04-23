-- IA helper para creación/redacción de bloques (Gemini vía Edge Function).
-- Incluye: logs de uso por organización, cuota mensual y RPC de chequeo.

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS ai_monthly_quota integer;

UPDATE public.organizations
SET ai_monthly_quota = 50
WHERE ai_monthly_quota IS NULL;

CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL CHECK (feature IN ('generate_routine', 'rewrite_block', 'draft_message', 'rm_format')),
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd_cents integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_org_created
  ON public.ai_generation_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_user_created
  ON public.ai_generation_logs (user_id, created_at DESC);

ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_logs_staff_read_member_orgs" ON public.ai_generation_logs;
CREATE POLICY "ai_logs_staff_read_member_orgs"
ON public.ai_generation_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = ai_generation_logs.organization_id
      AND m.active = true
      AND m.role IN ('coach', 'admin', 'owner', 'superadmin')
  )
);

DROP POLICY IF EXISTS "ai_logs_insert_own_org" ON public.ai_generation_logs;
CREATE POLICY "ai_logs_insert_own_org"
ON public.ai_generation_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = ai_generation_logs.organization_id
      AND m.active = true
      AND m.role IN ('coach', 'admin', 'owner', 'superadmin')
  )
);

CREATE OR REPLACE FUNCTION public.check_ai_quota(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used int;
  v_limit int;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = p_org_id
      AND m.active = true
      AND m.role IN ('coach', 'admin', 'owner', 'superadmin')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'forbidden'
    );
  END IF;

  SELECT COUNT(*)
  INTO v_used
  FROM public.ai_generation_logs l
  WHERE l.organization_id = p_org_id
    AND l.success = true
    AND l.created_at >= date_trunc('month', now());

  SELECT o.ai_monthly_quota
  INTO v_limit
  FROM public.organizations o
  WHERE o.id = p_org_id;

  IF v_limit IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'used', coalesce(v_used, 0),
      'limit', NULL,
      'remaining', -1
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', coalesce(v_used, 0) < v_limit,
    'used', coalesce(v_used, 0),
    'limit', v_limit,
    'remaining', greatest(v_limit - coalesce(v_used, 0), 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ai_quota(uuid) TO authenticated;
