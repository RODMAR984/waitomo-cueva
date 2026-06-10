/**
 * Destino post-auth para rol cliente.
 *
 * Panel solo si ya tiene plan activo o membresía cliente real (p. ej. tras código de invitación).
 * `organization_id` en perfil solo no basta: evita saltar WelcomeClientJoin por org seed legacy.
 *
 * @param {object} profile
 * @param {{ hasClientMembership?: boolean }} [opts]
 */
export function getClientPostAuthRouteName(profile, opts = {}) {
  const hasPlan = !!(profile?.plan_actual && String(profile.plan_actual).trim());
  if (hasPlan) return 'ClientTabs';

  const hasClientMembership = opts.hasClientMembership === true;
  if (hasClientMembership) return 'ClientTabs';

  return 'WelcomeClientJoin';
}
