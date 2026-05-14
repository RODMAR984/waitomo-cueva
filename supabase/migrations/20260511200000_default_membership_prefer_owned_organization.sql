-- Dueños / operadores de gym propio: is_default debe apuntar al centro donde sos owner,
-- no a una membresía "coach" empleada en otro club (p. ej. Waitomo) que quedó default por orden de creación.
--
-- Importante: el índice único parcial idx_org_memberships_one_default_active_per_user impide que
-- existan dos filas (active, is_default) para el mismo user_id. Un solo UPDATE que pone true/false
-- por fila puede violar la restricción en el paso intermedio; por eso dos fases.

WITH owners_choice AS (
  SELECT DISTINCT ON (m.user_id)
    m.user_id,
    m.id AS membership_id
  FROM public.organization_memberships m
  INNER JOIN public.organizations o ON o.id = m.organization_id AND o.owner_id = m.user_id
  WHERE m.active = true
  ORDER BY
    m.user_id,
    CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END,
    m.created_at
)
UPDATE public.organization_memberships m
SET is_default = false
WHERE m.active = true
  AND m.user_id IN (SELECT user_id FROM owners_choice);

WITH owners_choice AS (
  SELECT DISTINCT ON (m.user_id)
    m.user_id,
    m.id AS membership_id
  FROM public.organization_memberships m
  INNER JOIN public.organizations o ON o.id = m.organization_id AND o.owner_id = m.user_id
  WHERE m.active = true
  ORDER BY
    m.user_id,
    CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END,
    m.created_at
)
UPDATE public.organization_memberships m
SET is_default = true
FROM owners_choice oc
WHERE m.id = oc.membership_id
  AND m.active = true;
