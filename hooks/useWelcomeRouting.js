import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getClientPostAuthRouteName } from '../utils/clientPostAuthRoute';

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
  } = useAuth() || {};

  const navigateForStaffDual = useCallback(() => {
    // FitEngine: solo AdminLite si ya tiene org con owner_id = ella. Staff en Waitomo ≠ espacio propio.
    if (role === 'coach' || role === 'admin') {
      if (needsFitEngineSpaceSetup) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'ConfiguraTuEspacio', params: { email: session?.user?.email } }],
        });
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
      return;
    }
    if (ownedOrganizations?.length > 0) {
      navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
      return;
    }
    if (!profile) {
      navigation.reset({ index: 0, routes: [{ name: 'RegistroInicial' }] });
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'ConfiguraTuEspacio', params: { email: session?.user?.email } }],
    });
  }, [navigation, profile, role, needsFitEngineSpaceSetup, session?.user?.email]);

  const membershipsLoaded = Array.isArray(organizationMemberships);
  const isDualByMemberships = hasClientMembership && hasStaffMembership;

  const navigateToDestination = useCallback(
    (modeOverride) => {
      const mode = modeOverride !== undefined ? modeOverride : activeAppMode;
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

      if (role === 'superadmin') {
        navigation.reset({ index: 0, routes: [{ name: 'Admin' }] });
        return;
      }

      if (isDualByMemberships && !mode) {
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
          navigation.reset({ index: 0, routes: [{ name: 'RegistroInicial' }] });
          return;
        }
        navigation.reset({ index: 0, routes: [{ name: getClientPostAuthRouteName(profile) }] });
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
          navigation.reset({ index: 0, routes: [{ name: 'RegistroInicial' }] });
          return;
        }
        navigation.reset({ index: 0, routes: [{ name: getClientPostAuthRouteName(profile) }] });
        return;
      }

      if ((role === 'coach' || role === 'admin') && needsFitEngineSpaceSetup) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'ConfiguraTuEspacio', params: { email: session?.user?.email } }],
        });
        return;
      }

      if (role === 'coach' || role === 'admin') {
        navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
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
        navigation.reset({ index: 0, routes: [{ name: 'RegistroInicial' }] });
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: getClientPostAuthRouteName(profile) }] });
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
