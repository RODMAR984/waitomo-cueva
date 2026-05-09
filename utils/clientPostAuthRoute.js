/**
 * Destino por defecto para clientes con perfil ya cargado.
 * Con plan → panel. Sin plan pero con organización en perfil → selector de planes del gym.
 * Sin plan y sin organización: si ya hay membresía cliente (p. ej. desfase de sync), seguimos al selector;
 * si no, pantalla de código para no quedar en un PlanSelector vacío (flujo global FitEngine).
 *
 * @param {object} profile
 * @param {{ hasClientMembership?: boolean }} [opts]
 */
export function getClientPostAuthRouteName(profile, opts = {}) {
  const hasPlan = !!(profile?.plan_actual && String(profile.plan_actual).trim());
  if (hasPlan) return 'ClientTabs';

  const hasOrg = !!(profile?.organization_id && String(profile.organization_id).trim());
  if (!hasOrg) {
    const hasClientMembership = opts.hasClientMembership === true;
    if (!hasClientMembership) return 'JoinWithInvite';
  }
  return 'PlanSelector';
}
