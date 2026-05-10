// NavigationWrapper.js
import React from 'react';
import { useAuth } from './contexts/AuthContext';

import WelcomeScreen from './screens/auth/WelcomeScreen';
import ClientTabs from './screens/client/ClientTabs';

export default function NavigationWrapper() {
  const { session, loading } = useAuth();

  if (loading) return null;

  // 🔥 Si NO hay sesión → Welcome
  if (!session) return <WelcomeScreen />;

  // 🔥 Si SÍ hay sesión → Cliente
  return <ClientTabs />;
}
