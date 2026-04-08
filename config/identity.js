/**
 * Identidad en FitEngine / Waitomo
 *
 * - La cuenta real es auth.users: user id (UUID) + email. Son estables y únicos.
 * - NO usar nombres de organización ni nombres de persona para reglas de negocio o routing.
 * - organization_id (UUID en BD) es el vínculo a tenant; waitomoOrganizationId en config identifica la org Waitomo oficial.
 *
 * "Doble sombrero": misma persona puede ser cliente en un gym (profiles.organization_id)
 * y dueña de otra org (organizations.owner_id). El modelo profiles tiene un solo role/org;
 * la app complementa con activeAppMode (client | staff) + orgs donde owner_id = user.
 */

/**
 * @param {null|{ id?: string, email?: string }} sessionUser - session.user de Supabase
 * @returns {{ userId: string|null, email: string|null }}
 */
export function getSessionIdentity(sessionUser) {
  if (!sessionUser?.id) return { userId: null, email: null };
  return {
    userId: String(sessionUser.id),
    email: sessionUser.email ? String(sessionUser.email).trim().toLowerCase() : null,
  };
}

/** Solo para UI: mostrar email del usuario, no para políticas en cliente. */
export function formatIdentityLabel(identity) {
  if (!identity?.email) return identity?.userId || '';
  return identity.email;
}
