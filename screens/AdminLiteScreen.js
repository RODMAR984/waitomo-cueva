// screens/AdminLiteScreen.js — Waitomo Dark Only
// - Wrapper sobre AdminScreen
// - Superadmin usa modo "full"
// - Coach/otros usan modo "lite"
// - El botón "Salir" y los permisos ya se manejan dentro de AdminScreen

import React, { memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AdminScreen from './AdminScreen';

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
