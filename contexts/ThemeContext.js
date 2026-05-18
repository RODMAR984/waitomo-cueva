// contexts/ThemeContext.js — Waitomo Claro / Oscuro / Automático (#20b)
// - mode: 'light' | 'dark' | 'auto' (auto = claro 6–22h, oscuro resto)
// - Persiste en AsyncStorage y en Supabase (profiles.theme_mode)
// - t = getThemeTokens(effectiveMode, organization) — Waitomo fijo; org “sin marca” → shell FitEngine (#86C4C7); resto branding org

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemeTokens, getThemeTokensFitEnginePlatform } from '../theme/colors';
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
  t: getThemeTokensFitEnginePlatform('dark', null),
  clientThemeLocked: false,
});

function themePresetToBaseMode(preset) {
  const p = String(preset || '').toLowerCase();
  if (p.startsWith('light_')) return 'light';
  return 'dark';
}

export const ThemeProvider = ({ children }) => {
  const {
    profile,
    organization,
    user,
    hasClientMembership,
    hasStaffMembership,
    activeAppMode,
    ownedOrgsLoading,
    initialProfileSyncDone,
  } = useAuth() || {};
  const [mode, setModeState] = useState('dark');
  /** Evita flashes neutral→org cuando `organization` es null un instante (refresh, race al hidratar). */
  const lastOrgForThemeRef = useRef(null);
  const lastUserIdForThemeRef = useRef(null);

  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid !== lastUserIdForThemeRef.current) {
      lastUserIdForThemeRef.current = uid;
      if (!uid) lastOrgForThemeRef.current = null;
    }
    if (organization?.id) {
      lastOrgForThemeRef.current = organization;
    }
  }, [user?.id, organization]);

  /** Si el gym lo activa: en experiencia cliente no mezclar preset de la org con claro/oscuro del perfil. */
  const clientThemeLocked = useMemo(() => {
    if (!organization?.features?.lock_client_theme) return false;
    if (!hasClientMembership) return false;
    if (hasStaffMembership && activeAppMode === 'staff') return false;
    return true;
  }, [
    organization?.features?.lock_client_theme,
    hasClientMembership,
    hasStaffMembership,
    activeAppMode,
  ]);

  const orgLockedBaseMode = useMemo(
    () => themePresetToBaseMode(organization?.theme_preset),
    [organization?.theme_preset],
  );

  const effectiveMode = useMemo(() => {
    if (clientThemeLocked) {
      return orgLockedBaseMode;
    }
    return getEffectiveMode(mode);
  }, [clientThemeLocked, orgLockedBaseMode, mode]);

  const isDark = effectiveMode === 'dark';
  const t = useMemo(() => {
    const profileOrgId =
      profile?.organization_id && String(profile.organization_id).trim()
        ? String(profile.organization_id).trim()
        : null;
    const stillBootstrapping =
      !!user?.id && (ownedOrgsLoading || initialProfileSyncDone === false);

    let resolvedOrg = null;
    if (!user?.id) {
      resolvedOrg = null;
    } else if (organization?.id != null) {
      resolvedOrg = organization;
    } else if (stillBootstrapping && lastOrgForThemeRef.current?.id) {
      if (!profileOrgId || lastOrgForThemeRef.current.id === profileOrgId) {
        resolvedOrg = lastOrgForThemeRef.current;
      }
    }

    if (!resolvedOrg?.id) {
      return getThemeTokensFitEnginePlatform(effectiveMode, null);
    }
    return getThemeTokens(effectiveMode, resolvedOrg);
  }, [
    effectiveMode,
    organization,
    user?.id,
    profile?.organization_id,
    ownedOrgsLoading,
    initialProfileSyncDone,
  ]);

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
    // Contenedor de escenas del Stack: transparente para no tapar `BackgroundWrapper`.
    // Con `t.bg` / `t.boxBg` React Navigation pinta un rectángulo más oscuro sobre el fondo con foto.
    const colorsNav = {
      background: 'transparent',
      card: 'transparent',
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
      clientThemeLocked,
    }),
    [theme, mode, setMode, isDark, t, clientThemeLocked],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => useContext(ThemeContext);
