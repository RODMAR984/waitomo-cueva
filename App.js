// App.js — bootstrap + providers raíz + shell de navegación (lógica fina en otros módulos).

import React, { useEffect } from 'react';
import { Platform } from 'react-native';

import { ThemeProvider } from './contexts/ThemeContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { AuthProvider } from './contexts/AuthContext';

import { supabaseHealthCheck } from './supabaseClient';
import { runAppBootstrapOnce } from './bootstrap/runOnce';
import AppShellContent from './navigation/AppShellContent';
import AuthTraceWebOverlay from './components/AuthTraceWebOverlay';
import { authTrace } from './utils/authTrace';

runAppBootstrapOnce();

export default function App() {
  useEffect(() => {
    supabaseHealthCheck();
    authTrace('app_mount', { platform: Platform.OS });
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <LocaleProvider>
          <AppShellContent />
          {Platform.OS === 'web' ? <AuthTraceWebOverlay /> : null}
        </LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
