// screens/AdminLiteScreen.js — Waitomo Dark Only
// - Sin layout propio: el shell web (maxWidth / paneles) aplica vía AdminScreen + staffScreenShell.
// - Wrapper sobre AdminScreen
// - Superadmin usa modo "full"
// - Coach/otros usan modo "lite"
// - El botón "Salir" en web ancho vive en la barra lateral (`StaffWebDesktopShell`); en vista estrecha sigue en `AdminScreen`.

import React, { memo, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import {
  isIncompleteTrialOwner,
  readSignupIntent,
  trialSignupStackRoute,
} from '../../utils/trialSignupRouting';
import AdminScreen from './AdminScreen';

/** Re-export: misma spec de ancho web que el resto de screens; el layout efectivo está en AdminScreen + staffScreenShell. */
export { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
export { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
export { ADMIN_PANEL_GUTTER, ADMIN_SECTION_GAP, ADMIN_TABLE_ROW_MIN_HEIGHT } from '../../theme/adminSpec';

function AdminLiteScreen(props) {
  const navigation = useNavigation();
  const {
    isSuperAdmin,
    organizationsOwnedByUser,
    ownedOrganizations,
    profile,
    session,
    hasStaffMembership,
    authNavigationReady,
  } = useAuth();

  const isOrgOwner = (organizationsOwnedByUser?.length ?? 0) > 0;
  const isSA = typeof isSuperAdmin === 'function' ? isSuperAdmin() : false;

  /**
   * Owner de trial sin gym creado (sin org en perfil, sin memberships, sin org propia):
   * nunca renderizar un AdminLite "fantasma" que cae a defaults (estética/datos Waitomo).
   * Se lo manda a terminar la creación del gym en el flujo de trial.
   */
  const incompleteTrial = isIncompleteTrialOwner({
    signupIntent: readSignupIntent(session),
    profileOrganizationId: profile?.organization_id,
    ownedOrganizationsCount:
      (ownedOrganizations?.length ?? 0) + (organizationsOwnedByUser?.length ?? 0),
    hasStaffMembership,
  });

  useEffect(() => {
    if (!authNavigationReady || !incompleteTrial) return;
    navigation.reset({ index: 0, routes: [trialSignupStackRoute()] });
  }, [authNavigationReady, incompleteTrial, navigation]);

  if (incompleteTrial) {
    return null;
  }

  if (isSA || isOrgOwner) {
    // Superadmin y dueños de organización usan Admin "full"
    return <AdminScreen {...props} mode="full" />;
  }

  // Resto (coach empleado u otros) usan Admin "lite"
  return <AdminScreen {...props} mode="lite" />;
}

export default memo(AdminLiteScreen);
