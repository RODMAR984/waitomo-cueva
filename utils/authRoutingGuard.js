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
}) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'superadmin') return 'Admin';

  if (STAFF_ROLES.has(normalizedRole)) {
    return needsFitEngineSpaceSetup ? 'ConfiguraTuEspacio' : 'AdminLite';
  }

  if (ownedOrganizationsCount > 0) return 'AdminLite';
  if (!hasProfile) return 'RegistroInicial';
  return 'ConfiguraTuEspacio';
}

export function resolvePostAuthDestination({
  role,
  profile,
  forStaff = false,
  needsFitEngineSpaceSetup = false,
  authNavigationReady = true,
  hasClientMembership = false,
}) {
  const normalizedRole = normalizeRole(role || profile?.role);
  const hasProfile = !!profile;

  if (normalizedRole === 'superadmin') return 'Admin';

  if (STAFF_ROLES.has(normalizedRole)) {
    if (!authNavigationReady) return null;
    return needsFitEngineSpaceSetup ? 'ConfiguraTuEspacio' : 'AdminLite';
  }

  if (forStaff && !hasProfile) return 'ConfiguraTuEspacio';
  if (!hasProfile) return 'RegistroInicial';

  return getClientPostAuthRouteName(profile, { hasClientMembership });
}
