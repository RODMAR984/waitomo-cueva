// screens/AdminLiteScreen.js — Waitomo Dark Only
// - Wrapper sobre AdminScreen
// - Superadmin usa modo "full"
// - Coach/otros usan modo "lite"
// - El botón "Salir" y los permisos ya se manejan dentro de AdminScreen

import React, { memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AdminScreen from './AdminScreen';

function AdminLiteScreen(props) {
  const { currentUser, isSuperAdmin } = useAuth();

  if (isSuperAdmin(currentUser?.id)) {
    // Superadmin usa Admin "full"
    return <AdminScreen {...props} mode="full" />;
  }

  // Resto (coach u otros roles) usan Admin "lite"
  return <AdminScreen {...props} mode="lite" />;
}

export default memo(AdminLiteScreen);
