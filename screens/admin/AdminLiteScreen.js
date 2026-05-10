// screens/AdminLiteScreen.js — Waitomo Dark Only
// - Sin layout propio: el shell web (maxWidth / paneles) aplica vía AdminScreen + staffScreenShell.
// - Wrapper sobre AdminScreen
// - Superadmin usa modo "full"
// - Coach/otros usan modo "lite"
// - El botón "Salir" y los permisos ya se manejan dentro de AdminScreen

import React, { memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminScreen from './AdminScreen';

/** Re-export: misma spec de ancho web que el resto de screens; el layout efectivo está en AdminScreen + staffScreenShell. */
export { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
export { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
export { ADMIN_PANEL_GUTTER, ADMIN_SECTION_GAP, ADMIN_TABLE_ROW_MIN_HEIGHT } from '../../theme/adminSpec';

function AdminLiteScreen(props) {
  const { currentUser, isSuperAdmin, organizationsOwnedByUser } = useAuth();

  const isOrgOwner = (organizationsOwnedByUser?.length ?? 0) > 0;

  if (isSuperAdmin(currentUser?.id) || isOrgOwner) {
    // Superadmin y dueños de organización usan Admin "full"
    return <AdminScreen {...props} mode="full" />;
  }

  // Resto (coach empleado u otros) usan Admin "lite"
  return <AdminScreen {...props} mode="lite" />;
}

export default memo(AdminLiteScreen);
