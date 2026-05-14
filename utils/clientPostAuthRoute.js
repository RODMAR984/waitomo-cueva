/**
 * Destino por defecto para clientes con perfil ya cargado.
 *
 * Regla de producto (invitación / org): si el perfil ya tiene `organization_id`, el usuario ya
 * pertenece a un centro (p. ej. entró con código). No lo mandamos a PlanSelector al iniciar sesión:
 * eso duplicaba el flujo (elegir centro vs código) y retrasaba el ingreso. Elegir programa/abono
 * sigue disponible desde el panel (links a PlanSelector).
 *
 * Con `plan_actual` → panel. Con org en perfil → panel. Sin org: si hay membresía cliente (desfase
 * de sync) → panel; si no → **WelcomeClientJoin** (código o buscar centro en directorio).
 *
 * @param {object} profile
 * @param {{ hasClientMembership?: boolean }} [opts]
 */
export function getClientPostAuthRouteName(profile, opts = {}) {
  const hasPlan = !!(profile?.plan_actual && String(profile.plan_actual).trim());
  if (hasPlan) return 'ClientTabs';

  const hasOrg = !!(profile?.organization_id && String(profile.organization_id).trim());
  if (hasOrg) return 'ClientTabs';

  const hasClientMembership = opts.hasClientMembership === true;
  if (!hasClientMembership) return 'WelcomeClientJoin';

  return 'ClientTabs';
}
