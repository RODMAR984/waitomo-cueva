import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { navigationRef, resetNavigationRoot } from '../navigationRef';
import { getClientPostAuthRouteName } from '../utils/clientPostAuthRoute';
import { resolveStaffDestination } from '../utils/authRoutingGuard';
import { authTrace } from '../utils/authTrace';

function resetStackTo(navigation, routes) {
  const state = { index: 0, routes };
  if (navigationRef.isReady() && resetNavigationRoot(state)) {
    return;
  }
  try {
    navigation.reset(state);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('ROUTING_DEBUG resetStackTo failed', e?.message || e);
  }
}

/**
 * Navegación post-welcome: destino según rol, membresías y modo (cliente/staff).
 * Compartido entre WelcomeGlobal y WelcomeDualChoice.
 */
export function useWelcomeRouting() {
  const navigation = useNavigation();
  const {
    session,
    profile,
    role,
    isDualHatUser,
    activeAppMode,
    persistActiveAppMode,
    ownedOrganizations,
    organizationsOwnedByUser,
    needsFitEngineSpaceSetup,
    organizationMemberships,
    hasStaffMembership,
    hasClientMembership,
    isPlatformAdmin,
    platformAdminActive,
    initialProfileSyncDone,
    authSessionRestored,
    authNavigationReady,
    authBootstrapReady,
  } = useAuth() || {};

  const navigateForStaffDual = useCallback(() => {
    const destination = resolveStaffDestination({
      role,
      needsFitEngineSpaceSetup,
      hasProfile: !!profile,
      ownedOrganizationsCount: ownedOrganizations?.length || 0,
      isPlatformAdmin: typeof isPlatformAdmin === 'function' && isPlatformAdmin(),
      hasStaffMembership,
      profileOrganizationId: profile?.organization_id,
    });
    const params =
      destination === 'ConfiguraTuEspacio' || destination === 'FitEngineSpaceIntro'
        ? { email: session?.user?.email }
        : undefined;
    resetStackTo(navigation, [{ name: destination, params }]);
  }, [
    navigation,
    ownedOrganizations?.length,
    profile,
    profile?.organization_id,
    role,
    needsFitEngineSpaceSetup,
    session?.user?.email,
    isPlatformAdmin,
    platformAdminActive,
    hasStaffMembership,
  ]);

  const membershipsLoaded = Array.isArray(organizationMemberships);
  const isDualByMemberships = hasClientMembership && hasStaffMembership;

  const navigateToDestination = useCallback(
    (modeOverride) => {
      const mode = modeOverride !== undefined ? modeOverride : activeAppMode;

      if (authSessionRestored === false) {
        authTrace('navigateToDestination_skip', { reason: 'auth_session_not_restored' });
        return;
      }
      if (session?.user?.id && initialProfileSyncDone === false) {
        authTrace('navigateToDestination_skip', { reason: 'initial_profile_sync_pending' });
        return;
      }
      if (session?.user?.id && authBootstrapReady !== true) {
        authTrace('navigateToDestination_skip', {
          reason: 'bootstrap_not_ready',
          hasProfile: !!profile?.id,
        });
        return;
      }
      if (session?.user?.id && profile?.id && profile.id !== session.user.id) {
        authTrace('navigateToDestination_skip', {
          reason: 'profile_id_mismatch',
          hasProfile: true,
        });
        return;
      }

      // eslint-disable-next-line no-console
      console.log('ROUTING_DEBUG WelcomeGlobal navigateToDestination', {
        modeOverride,
        resolvedMode: mode,
        role,
        hasStaffMembership,
        hasClientMembership,
        isDualByMemberships,
        isDualHatUser,
        ownedOrgsCount: ownedOrganizations?.length ?? 0,
        orgsOwnedByUserCount: organizationsOwnedByUser?.length ?? 0,
        needsFitEngineSpaceSetup,
      });

      authTrace('navigateToDestination', {
        modeOverride: modeOverride === undefined ? null : String(modeOverride),
        resolvedMode: mode ?? null,
        role: role ?? null,
        profileId: profile?.id ?? null,
        sessionUserId: session?.user?.id ? '(set)' : null,
        initialProfileSyncDone: initialProfileSyncDone !== false,
        authSessionRestored: authSessionRestored !== false,
        authNavigationReady: authNavigationReady !== false,
        hasStaffMembership,
        hasClientMembership,
        ownedOrgsCount: ownedOrganizations?.length ?? 0,
      });

      if (role === 'superadmin' || (typeof isPlatformAdmin === 'function' && isPlatformAdmin())) {
        const orgIdHint = !!(profile?.organization_id && String(profile.organization_id).trim());
        const hasStaffOrgHint =
          (organizationsOwnedByUser?.length || 0) > 0 ||
          hasStaffMembership ||
          orgIdHint;
        resetStackTo(navigation, [{ name: hasStaffOrgHint ? 'AdminLite' : 'Superadmin' }]);
        return;
      }

      if (isDualByMemberships && !mode) {
        // "Continuar" nunca debe quedar en no-op: elegimos un modo por defecto.
        const fallbackMode = hasClientMembership ? 'client' : 'staff';
        // eslint-disable-next-line no-console
        console.log('ROUTING_DEBUG WelcomeGlobal dual without mode, using fallback', {
          fallbackMode,
          hasClientMembership,
          hasStaffMembership,
        });
        if (persistActiveAppMode && session?.user?.id) {
          void persistActiveAppMode(fallbackMode, session.user.id);
        }
        if (fallbackMode === 'staff') {
          navigateForStaffDual();
          return;
        }
        if (!profile) {
          authTrace('navigate_route', { name: 'RegistroInicial', branch: 'dual_fallback_no_profile' });
          resetStackTo(navigation, [{ name: 'RegistroInicial' }]);
          return;
        }
        resetStackTo(navigation, [{ name: getClientPostAuthRouteName(profile, { hasClientMembership }) }]);
        return;
      }

      if (
        mode === 'client' &&
        membershipsLoaded &&
        hasStaffMembership &&
        !hasClientMembership
      ) {
        if (persistActiveAppMode && session?.user?.id) {
          void persistActiveAppMode('staff', session.user.id);
        }
        navigateForStaffDual();
        return;
      }

      if ((isDualByMemberships || isDualHatUser) && mode === 'client') {
        if (!profile) {
          authTrace('navigate_route', { name: 'RegistroInicial', branch: 'dual_client_no_profile' });
          resetStackTo(navigation, [{ name: 'RegistroInicial' }]);
          return;
        }
        resetStackTo(navigation, [{ name: getClientPostAuthRouteName(profile, { hasClientMembership }) }]);
        return;
      }

      if ((isDualByMemberships || isDualHatUser) && mode === 'staff') {
        navigateForStaffDual();
        return;
      }

      if (membershipsLoaded && hasStaffMembership && !hasClientMembership) {
        if (persistActiveAppMode && session?.user?.id) {
          void persistActiveAppMode('staff', session.user.id);
        }
        navigateForStaffDual();
        return;
      }
      if (membershipsLoaded && hasClientMembership && !hasStaffMembership) {
        if (!profile) {
          authTrace('navigate_route', { name: 'RegistroInicial', branch: 'client_member_no_profile' });
          resetStackTo(navigation, [{ name: 'RegistroInicial' }]);
          return;
        }
        resetStackTo(navigation, [{ name: getClientPostAuthRouteName(profile, { hasClientMembership }) }]);
        return;
      }

      if (
        (role === 'coach' || role === 'admin') &&
        needsFitEngineSpaceSetup &&
        !hasStaffMembership &&
        (ownedOrganizations?.length || 0) === 0
      ) {
        resetStackTo(navigation, [
          { name: 'FitEngineSpaceIntro', params: { email: session?.user?.email } },
        ]);
        return;
      }

      if (role === 'coach' || role === 'admin') {
        if (!hasStaffMembership && (ownedOrganizations?.length || 0) === 0) {
          authTrace('navigateToDestination_skip', { reason: 'staff_no_context' });
          return;
        }
        resetStackTo(navigation, [{ name: 'AdminLite' }]);
        return;
      }
      if (ownedOrganizations?.length > 0 && !hasClientMembership) {
        if (persistActiveAppMode && session?.user?.id) {
          void persistActiveAppMode('staff', session.user.id);
        }
        navigateForStaffDual();
        return;
      }
      if (!profile) {
        authTrace('navigate_route', { name: 'RegistroInicial', branch: 'default_no_profile' });
        resetStackTo(navigation, [{ name: 'RegistroInicial' }]);
        return;
      }
      const clientDest = getClientPostAuthRouteName(profile, { hasClientMembership });
      authTrace('navigate_route', { name: clientDest, branch: 'default_client_post_auth' });
      resetStackTo(navigation, [{ name: clientDest }]);
    },
    [
      navigation,
      role,
      profile,
      membershipsLoaded,
      hasStaffMembership,
      hasClientMembership,
      isDualByMemberships,
      isDualHatUser,
      activeAppMode,
      navigateForStaffDual,
      persistActiveAppMode,
      session?.user?.id,
      ownedOrganizations,
      organizationsOwnedByUser,
      needsFitEngineSpaceSetup,
      isPlatformAdmin,
      platformAdminActive,
      initialProfileSyncDone,
      authSessionRestored,
      authNavigationReady,
      authBootstrapReady,
    ],
  );

  const onDualClient = useCallback(async () => {
    if (!persistActiveAppMode) return;
    await persistActiveAppMode('client');
    navigateToDestination('client');
  }, [persistActiveAppMode, navigateToDestination]);

  const onDualStaff = useCallback(async () => {
    if (!persistActiveAppMode) return;
    await persistActiveAppMode('staff');
    navigateToDestination('staff');
  }, [persistActiveAppMode, navigateToDestination]);

  const onContinue = useCallback(() => {
    navigateToDestination();
  }, [navigateToDestination]);

  return {
    navigateToDestination,
    navigateForStaffDual,
    onDualClient,
    onDualStaff,
    onContinue,
    isDualByMemberships,
  };
}
