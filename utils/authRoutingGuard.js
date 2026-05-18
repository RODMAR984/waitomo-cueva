import { getClientPostAuthRouteName } from './clientPostAuthRoute';

const STAFF_ROLES = new Set(['coach', 'admin']);

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

export function resolveStaffDestination({
  role,
  needsFitEngineSpaceSetup = false,
  hasProfile = false,
  ownedOrganizationsCount = 0,
  isPlatformAdmin = false,
  /** True si hay membresía activa con rol staff (owner/coach/admin), aunque el embed `organizations` venga null (RLS). */
  hasStaffMembership = false,
  /** `profiles.organization_id` — vínculo a un centro aunque memberships/embeds aún no cargaron. */
  profileOrganizationId = null,
}) {
  const normalizedRole = normalizeRole(role);
  const orgIdHint = !!(profileOrganizationId && String(profileOrganizationId).trim());
  const hasStaffOrgHint =
    (ownedOrganizationsCount || 0) > 0 || hasStaffMembership || orgIdHint;

  // Plataforma: sin gym propio → hub. Si también sos dueño/staff de un centro (p. ej. Waitomo) → admin del gym.
  if (normalizedRole === 'superadmin' || isPlatformAdmin) {
    return hasStaffOrgHint ? 'AdminLite' : 'Superadmin';
  }

  if (STAFF_ROLES.has(normalizedRole)) {
    if (hasStaffOrgHint) return 'AdminLite';
    return needsFitEngineSpaceSetup ? 'FitEngineSpaceIntro' : 'AdminLite';
  }

  // `profiles.role === 'owner'` no pasa por STAFF_ROLES (solo coach|admin). Sin orgs en contexto
  // caía al fallback final → ConfiguraTuEspacio aunque ya exista el gym (ownedOrgs vacío por embed RLS).
  if (normalizedRole === 'owner') {
    if (hasStaffOrgHint) return 'AdminLite';
    if (!hasProfile) return 'RegistroInicial';
    return 'FitEngineSpaceIntro';
  }

  if (hasStaffOrgHint) return 'AdminLite';
  if (!hasProfile) return 'RegistroInicial';
  return 'FitEngineSpaceIntro';
}

export function resolvePostAuthDestination({
  role,
  profile,
  forStaff = false,
  needsFitEngineSpaceSetup = false,
  authNavigationReady = true,
  hasClientMembership = false,
  isPlatformAdmin = false,
  hasStaffMembership = false,
  ownedOrganizationsCount = 0,
}) {
  const normalizedRole = normalizeRole(role || profile?.role);
  const hasProfile = !!profile;
  const orgIdHint = !!(profile?.organization_id && String(profile.organization_id).trim());
  const hasStaffOrgHint =
    (ownedOrganizationsCount || 0) > 0 || hasStaffMembership === true || orgIdHint;

  // Plataforma: sin gym propio → hub. Dueño/admin de Waitomo u otro centro → AdminLite (plataforma desde menú).
  if (normalizedRole === 'superadmin' || isPlatformAdmin) {
    return hasStaffOrgHint ? 'AdminLite' : 'Superadmin';
  }

  if (STAFF_ROLES.has(normalizedRole)) {
    // Tras login el perfil ya viene en mano; no bloquear por fetch de memberships en vuelo.
    if (!authNavigationReady && !hasProfile) return null;
    if (hasStaffOrgHint) return 'AdminLite';
    return needsFitEngineSpaceSetup ? 'FitEngineSpaceIntro' : 'AdminLite';
  }

  // Dueño de gym: el login no debe mandar al panel cliente (`getClientPostAuthRouteName`).
  if (normalizedRole === 'owner') {
    if (!authNavigationReady && !hasProfile) return null;
    if (forStaff && !hasProfile) return 'FitEngineSpaceIntro';
    if (!hasProfile) return 'RegistroInicial';
    return hasStaffOrgHint ? 'AdminLite' : 'FitEngineSpaceIntro';
  }

  if (forStaff && !hasProfile) return 'FitEngineSpaceIntro';
  if (!hasProfile) return 'RegistroInicial';

  return getClientPostAuthRouteName(profile, { hasClientMembership });
}
