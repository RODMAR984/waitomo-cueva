// contexts/ThemeContext.js — Waitomo Claro / Oscuro / Automático (#20b)
// - mode: 'light' | 'dark' | 'auto' (auto = claro 6–22h, oscuro resto)
// - Persiste en AsyncStorage y en Supabase (profiles.theme_mode)
// - t = getThemeTokens(effectiveMode, organization) — Waitomo fijo, otras orgs con accent_color + preset

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemeTokens } from '../theme/colors';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'themeMode';

function getEffectiveMode(mode) {
  if (mode !== 'auto') return mode;
  const h = new Date().getHours();
  return h >= 6 && h < 22 ? 'light' : 'dark';
}

const ThemeContext = createContext({
  theme: NavDarkTheme,
  mode: 'dark',
  setMode: () => {},
  isDark: true,
  t: getThemeTokens('dark'),
});

export const ThemeProvider = ({ children }) => {
  const { profile, organization } = useAuth() || {};
  const [mode, setModeState] = useState('dark');

  const effectiveMode = useMemo(() => getEffectiveMode(mode), [mode]);
  const isDark = effectiveMode === 'dark';
  const t = useMemo(
    () => getThemeTokens(effectiveMode, organization),
    [effectiveMode, organization],
  );

  // Cargar modo: primero AsyncStorage, luego si hay profile.theme_mode lo aplicamos y sincronizamos
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'auto') setModeState(saved);
      } catch {
        // sin-op
      }
    })();
  }, []);

  // Cuando carga el profile, preferir theme_mode de Supabase
  useEffect(() => {
    const profileMode = profile?.theme_mode;
    if (profileMode === 'light' || profileMode === 'dark' || profileMode === 'auto') {
      setModeState(profileMode);
      AsyncStorage.setItem(STORAGE_KEY, profileMode).catch(() => {});
    }
  }, [profile?.id, profile?.theme_mode]);

  // Cuando cambia la hora y el modo es auto, re-render con effectiveMode actualizado (cada minuto)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (mode !== 'auto') return;
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [mode]);

  const setMode = useCallback(async (newMode) => {
    if (newMode !== 'light' && newMode !== 'dark' && newMode !== 'auto') return;
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // sin-op
    }
    if (profile?.id) {
      try {
        await supabase.from('profiles').update({ theme_mode: newMode }).eq('id', profile.id);
      } catch {
        // sin-op
      }
    }
  }, [profile?.id]);

  const theme = useMemo(() => {
    const colorsNav = {
      background: t.bg,
      card: t.boxBg,
      border: t.overlayBorder,
      text: t.text,
      primary: t.brand,
      notification: t.brand,
    };
    if (isDark) {
      return { ...NavDarkTheme, dark: true, colors: { ...NavDarkTheme.colors, ...colorsNav } };
    }
    return { ...NavLightTheme, dark: false, colors: { ...NavLightTheme.colors, ...colorsNav } };
  }, [t, isDark]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      setMode,
      isDark,
      t,
    }),
    [theme, mode, setMode, isDark, t],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => useContext(ThemeContext);
