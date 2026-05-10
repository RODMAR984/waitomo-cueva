// App.js — bootstrap + providers raíz + shell de navegación (lógica fina en otros módulos).

import React, { useEffect } from 'react';

import { ThemeProvider } from './contexts/ThemeContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { AuthProvider } from './contexts/AuthContext';

import { supabaseHealthCheck } from './supabaseClient';
import { runAppBootstrapOnce } from './bootstrap/runOnce';
import AppShellContent from './navigation/AppShellContent';

runAppBootstrapOnce();

export default function App() {
  useEffect(() => {
    supabaseHealthCheck();
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <LocaleProvider>
          <AppShellContent />
        </LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
