/**
 * Org usada para pull/sync de training_daily_blocks.
 * Debe coincidir con orgIdForPlans en AdminScreen.
 */
export function resolveTrainingBlocksOrgId({
  organizationsOwnedByUser,
  organization,
  profile,
  activeAppMode,
  activeAppModeHydrated,
  isDualHatUser,
}) {
  const owned = Array.isArray(organizationsOwnedByUser) ? organizationsOwnedByUser : [];
  const profOrg =
    profile?.organization_id && String(profile.organization_id).trim()
      ? String(profile.organization_id).trim()
      : null;

  if (activeAppModeHydrated && activeAppMode === 'staff') {
    if (owned.length === 1) return owned[0].id;
    if (owned.length > 1) {
      const primaryOwned = owned.find((o) => String(o.id) !== profOrg) || owned[0];
      return primaryOwned?.id || organization?.id || profOrg || null;
    }
    return organization?.id || profOrg || null;
  }

  if (!isDualHatUser && owned.length === 1) return owned[0].id;

  return organization?.id ?? profOrg ?? owned[0]?.id ?? null;
}
