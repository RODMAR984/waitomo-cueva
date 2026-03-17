// contexts/ThemeContext.js — Waitomo Claro / Oscuro / Automático
// - mode: 'light' | 'dark' | 'auto'
// - auto: claro 6–22h, oscuro resto
// - Expone: theme, mode, setMode, isDark, t (tokens del modo efectivo)

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemeTokens } from '../theme/colors';

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
  const [mode, setModeState] = useState('dark');

  const effectiveMode = useMemo(() => getEffectiveMode(mode), [mode]);
  const isDark = effectiveMode === 'dark';
  const t = useMemo(() => getThemeTokens(effectiveMode), [effectiveMode]);

  // Cargar modo guardado al montar
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
  }, []);

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
