// screens/ClientScreen.js — FIX definitivo
// ✅ Plan activo: activePlanId (AuthContext) -> profile.plan_actual -> AsyncStorage
// ✅ NO depende de user_abonos/user_plans para “mostrar plan”
// ✅ Logout: usa logout() y fuerza reset al Welcome

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { supabase } from '../supabaseClient';
import { navigationRef } from '../navigationRef';

// ---------- helpers ----------
const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const getGreetingKey = (h) => {
  if (h < 6) return 'client_greeting_night';
  if (h < 12) return 'client_greeting_morning';
  if (h < 19) return 'client_greeting_afternoon';
  return 'client_greeting_evening';
};

const PLAN_LABELS = {
  cross: 'CROSS TRAINING',
  hyrox: 'HYROX',
  evolucion: 'CICLO EVOLUCIÓN',
  stretching: 'STRETCHING',
  yoga: 'YOGA',
  openbox: 'OPEN BOX',
  oly: 'OLY',
  all_access: 'Pase libre (acceso total)',
};

const PLAN_CANON_ID = {
  cross: 'cross',
  hyrox: 'hyrox',
  evolucion: 'evolucion',
  stretching: 'stretching',
  yoga: 'yoga',
  openbox: 'openbox',
  oly: 'oly',
  all_access: 'all_access',
};

// Valor de plan que usa Admin al guardar bloques (debe coincidir con PLANS[].value en AdminScreen)
const PLAN_KEY_TO_ADMIN_VALUE = {
  cross: 'cross_training',
  openbox: 'open_box',
  evolucion: 'ciclo_evolucion',
  yoga: 'yoga',
  stretching: 'stretching',
  hyrox: 'hyrox',
  oly: 'oly',
  all_access: 'all_access',
};

const normalizePlanKey = (raw) => {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return null;
  if (s.includes('cross')) return 'cross';
  if (s.includes('hyrox')) return 'hyrox';
  if (s.includes('evol')) return 'evolucion';
  if (s.includes('stretch')) return 'stretching';
  if (s.includes('yoga')) return 'yoga';
  if (s.includes('open')) return 'openbox';
  if (s.includes('oly') || s.includes('olímp')) return 'oly';
  if (s.includes('all')) return 'all_access';
  return s.replace(/\s+/g, '_');
};

const isHttp = (s) => /^https?:\/\//i.test(String(s || ''));

const fmtDate = (isoOrDate) => {
  try {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear());
    return `${dd}/${mm}/${yy}`;
  } catch {
    return null;
  }
};

const calcDaysLeft = (endAt) => {
  if (!endAt) return null;
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
};

const getAbonoStatusKey = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'active') return 'client_status_active';
  if (v === 'pending') return 'client_status_pending';
  if (v === 'expired') return 'client_status_expired';
  if (v === 'cancelled') return 'client_status_cancelled';
  return null;
};

const STORAGE_PLAN_ACTUAL = 'waitomo_plan_actual';
const CHAT_LAST_OPEN = 'waitomo_chat_last_open';

// ---------- SCREEN ----------
export default function ClientScreen() {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const navigation = useNavigation();

  const {
    profile,
    user,
    logout,
    activePlanId,
    ensureProfile,
    organization,
    activeAppMode,
    ownedOrganizations,
    organizationsOwnedByUser,
    needsFitEngineSpaceSetup,
    authNavigationReady,
    initialProfileSyncDone,
    hasStaffMembership,
    hasClientMembership,
    persistActiveAppMode,
  } = useAuth() || {};
  const saludo = tStr(getGreetingKey(new Date().getHours()));

  const nombre =
    profile?.full_name ||
    profile?.nombre ||
    user?.email?.split('@')?.[0] ||
    tStr('common_user');

  const aptoMedico = !!(profile?.apto_medico_url || profile?.aptoMedico);

  // ✅ Avatar: solo mostramos URL pública (https) o path de Storage. file:// no existe tras borrar datos.
  const rawAvatar = profile?.avatar_url || null;
  const [avatarUri, setAvatarUri] = useState(null);

  useEffect(() => {
    let alive = true;

    if (!rawAvatar) {
      if (alive) setAvatarUri(null);
      return () => { alive = false; };
    }

    if (String(rawAvatar).startsWith('file://')) {
      if (alive) setAvatarUri(null);
      return () => { alive = false; };
    }

    if (isHttp(rawAvatar)) {
      if (alive) setAvatarUri(rawAvatar);
      return () => { alive = false; };
    }

    try {
      const cleaned = String(rawAvatar).replace(/^avatars\//i, '');
      const { data } = supabase.storage.from('avatars').getPublicUrl(cleaned);
      const pub = data?.publicUrl || null;
      if (alive) setAvatarUri(pub || null);
    } catch {
      if (alive) setAvatarUri(null);
    }

    return () => { alive = false; };
  }, [rawAvatar]);

  // ✅ PLAN: activePlanId -> profile.plan_actual -> AsyncStorage
  const [planKey, setPlanKey] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      // eslint-disable-next-line no-console
      console.log('🔄 ClientScreen: efecto plan/abono, userId =>', user?.id || null);

      const fromCtx = normalizePlanKey(activePlanId);
      if (fromCtx) {
        if (alive) {
          setPlanKey(fromCtx);
          setPlanLoading(false);
        }
        return;
      }

      const fromProfile = normalizePlanKey(profile?.plan_actual || profile?.planActual);
      if (fromProfile) {
        if (alive) {
          setPlanKey(fromProfile);
          setPlanLoading(false);
        }
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(STORAGE_PLAN_ACTUAL);
        const fromStore = normalizePlanKey(stored);
        if (alive) {
          setPlanKey(fromStore);
          setPlanLoading(false);
        }
      } catch {
        if (alive) {
          setPlanKey(null);
          setPlanLoading(false);
        }
      }
    };

    setPlanLoading(true);
    load();

    return () => {
      alive = false;
    };
  }, [activePlanId, profile?.plan_actual, profile?.planActual]);

  const canonId = planKey ? (PLAN_CANON_ID[planKey] || planKey) : null;
  const planLabel = planKey ? (PLAN_LABELS[planKey] || planKey.toUpperCase()) : 'Sin plan activo';
  const planObj = canonId ? { id: canonId, title: planLabel, active: true } : null;

  // ✅ abono: solo para mostrar fechas/estado (NO define el plan)
  const [abonoRow, setAbonoRow] = useState(null);
  const [abonoLoading, setAbonoLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        if (!user?.id) {
          if (alive) {
            setAbonoRow(null);
            setAbonoLoading(false);
          }
          return;
        }

        // eslint-disable-next-line no-console
        console.log('🔄 ClientScreen: cargando abono para user', user.id);

        // Timeout de seguridad: si Supabase se cuelga, no dejamos el spinner eterno
        let timeoutId = null;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Timeout user_abonos (8s)')),
            8000,
          );
        });

        const queryPromise = supabase
          .from('user_abonos')
          .select(
            'id, plan_id, status, start_date, end_date, sessions_total, sessions_used, created_at',
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const raced = await Promise.race([queryPromise, timeoutPromise]);

        if (timeoutId) clearTimeout(timeoutId);

        // Si vino del timeoutPromise, es un Error y lo propagamos
        if (raced instanceof Error) {
          throw raced;
        }

        const { data, error } = raced || {};

        if (error) {
          // eslint-disable-next-line no-console
          console.log('❌ ClientScreen: error cargando user_abonos:', error.message);
          throw error;
        }

        const row = Array.isArray(data) ? data[0] : null;
        if (alive) {
          setAbonoRow(row || null);
          setAbonoLoading(false);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('❌ ClientScreen: catch en carga de abono:', e?.message || e);
        if (alive) {
          setAbonoRow(null);
          setAbonoLoading(false);
        }
      }
    };

    setAbonoLoading(true);
    load();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const abonoStatusKey = getAbonoStatusKey(abonoRow?.status);
  const abonoStatusLabel = abonoStatusKey ? tStr(abonoStatusKey) : (abonoRow?.status || '—');
  const startFmt = fmtDate(abonoRow?.start_date);
  const endFmt = fmtDate(abonoRow?.end_date);
  const daysLeft = calcDaysLeft(abonoRow?.end_date);

  // Plan = tipo (Cross, Yoga…). Abono = pase comprado con fechas/estado (viene de user_abonos).
  const planHintLine = (() => {
    if (abonoLoading) return tStr('client_loading_abono');
    if (!abonoRow) return tStr('client_no_abono');
    if (startFmt && endFmt) {
      const dl = typeof daysLeft === 'number' ? ` • ${daysLeft} ${tStr('client_days')}` : '';
      return `${abonoStatusLabel} • ${tStr('client_abono_start')}: ${startFmt} • ${tStr('client_abono_end')}: ${endFmt}${dl}`;
    }
    if (endFmt) {
      const dl = typeof daysLeft === 'number' ? ` • ${daysLeft} ${tStr('client_days')}` : '';
      return `${abonoStatusLabel} • ${tStr('client_abono_end')}: ${endFmt}${dl}`;
    }
    return `${abonoStatusLabel} • Tocá para ver detalle.`;
  })();

  // Siempre a DetalleAbono: con abono muestra fechas/estado; sin abono muestra "No hay abono" + botón a planes.
  // Así no mandamos al usuario directo a la lista de planes (flujo que parece registro).
  const goPlanAbonoDetail = () => {
    const ok = safeNavigate(['DetalleAbono', 'DetalleAbonoScreen'], {
      planKey: canonId,
      plan: planObj,
      subscription: abonoRow || null,
    });
    if (!ok) Alert.alert(tStr('client_route_not_found'), tStr('client_detalle_abono_missing'));
  };

  // ✅ navegación robusta (tabs -> stack padre)
  const safeNavigate = useCallback(
    (names, params) => {
      const list = Array.isArray(names) ? names : [names];
      const navs = [
        navigation,
        navigation?.getParent?.(),
        navigation?.getParent?.()?.getParent?.(),
      ].filter(Boolean);

      for (const nav of navs) {
        for (const name of list) {
          try {
            nav.navigate(name, params);
            return true;
          } catch {
            // seguir
          }
        }
      }
      return false;
    },
    [navigation]
  );

  const goCalendario = () => {
    if (!planObj) {
      Alert.alert(tStr('client_no_plan'), tStr('client_no_plan_message'));
      return;
    }
    const ok = safeNavigate(['Calendario', 'CalendarioScreen'], {
      plan: planObj,
      planKey: canonId,
      userData: {
        hasMedicalCertificate: aptoMedico,
        createdAt: profile?.created_at || null,
      },
    });
    if (!ok) Alert.alert(tStr('client_route_not_found'), tStr('client_calendario_missing'));
  };

  const goTrabajoHoy = () => {
    if (!planObj) {
      Alert.alert(tStr('client_no_plan'), tStr('client_no_plan_message'));
      return;
    }
    const planValue = planKey ? (PLAN_KEY_TO_ADMIN_VALUE[planKey] || planKey) : canonId;
    const hoy = new Date();
    const fechaHoy = hoy.toISOString().slice(0, 10);
    const ok = safeNavigate(['TrabajoDelDia', 'TrabajoDelDiaScreen'], {
      from: 'ClientScreen',
      plan: { ...planObj, nombre: planLabel, planValue },
      planKey: canonId,
      planValue,
      fecha: fechaHoy,
      userData: {
        hasMedicalCertificate: aptoMedico,
        createdAt: profile?.created_at || null,
      },
    });
    if (!ok) Alert.alert(tStr('client_route_not_found'), tStr('client_trabajo_missing'));
  };

  const goPerfil = () => {
    safeNavigate(['PerfilUsuario', 'PerfilUsuarioScreen', 'Perfil'], {
      plan: planObj || undefined,
      planKey: canonId,
    });
  };

  const goNovedades = () => {
    safeNavigate(['Novedades', 'NovedadesScreen']);
  };

  const goChat = () => {
    safeNavigate(['ChatCanales', 'ChatCanalesScreen']);
  };

  // ---------------------------------------------
  // Novedades (gym_news) — preview con ticker, timeout y fallback
  // ---------------------------------------------
  const [novedades, setNovedades] = useState([]);
  const [novedadesLoading, setNovedadesLoading] = useState(true);
  const [novedadesTickerIndex, setNovedadesTickerIndex] = useState(0);
  const novedadesTickerPausedRef = useRef(false);
  const novedadesMarqueeAnim = useRef(new Animated.Value(0)).current;
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      if (alive && novedadesLoading) setNovedadesLoading(false);
    }, 5000);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('gym_news')
          .select('id, title, body, image_url, tag, pinned, created_at')
          .eq('is_active', true)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5);
        if (!alive) return;
        if (error) throw error;
        setNovedades(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setNovedades([]);
      } finally {
        if (alive) setNovedadesLoading(false);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (novedades.length <= 1) return;
    const id = setInterval(() => {
      if (novedadesTickerPausedRef.current) return;
      setNovedadesTickerIndex((i) => (i + 1) % novedades.length);
    }, 3500);
    return () => clearInterval(id);
  }, [novedades.length]);

  // Marquee: scroll automático del título de la novedad actual
  const currentNovedadTitle = novedades[novedadesTickerIndex]?.title || '';
  useEffect(() => {
    if (!currentNovedadTitle || novedadesTickerPausedRef.current) return;
    novedadesMarqueeAnim.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(novedadesMarqueeAnim, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: true,
        }),
        Animated.timing(novedadesMarqueeAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [currentNovedadTitle, novedadesTickerIndex]);

  // Contador de mensajes sin leer (desde última vez que abrió el chat)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id || !planKey) {
        if (alive) setUnreadChatCount(0);
        return;
      }
      try {
        const lastOpen = await AsyncStorage.getItem(CHAT_LAST_OPEN);
        if (!lastOpen) {
          if (alive) setUnreadChatCount(0);
          return;
        }
        const { data: channels } = await supabase
          .from('chat_channels')
          .select('id')
          .eq('plan_id', planKey);
        const channelIds = (channels || []).map((c) => c.id);
        if (channelIds.length === 0) {
          if (alive) setUnreadChatCount(0);
          return;
        }
        let total = 0;
        for (const cid of channelIds) {
          const { count, error } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', cid)
            .gt('created_at', lastOpen);
          if (!error && typeof count === 'number') total += count;
        }
        if (alive) setUnreadChatCount(total);
      } catch {
        if (alive) setUnreadChatCount(0);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, planKey]);

  // Si hay user pero no perfil (cuenta borrada o sin completar), ir a completar registro.
  useEffect(() => {
    if (!user?.id) return;
    if (initialProfileSyncDone === false) return;
    if (profile?.id) return;
    if (!navigationRef.isReady()) return;
    navigationRef.resetRoot({ index: 0, routes: [{ name: 'RegistroInicial' }] });
  }, [user?.id, profile?.id, initialProfileSyncDone]);

  // Guardia anti-ruta equivocada: no quedarse en panel cliente si la cuenta es gym/staff.
  useEffect(() => {
    if (!user?.id) return;
    if (!authNavigationReady) return;
    if (initialProfileSyncDone === false) return;

    const hasOwnedFitEngineOrgs =
      Array.isArray(organizationsOwnedByUser) && organizationsOwnedByUser.length > 0;
    const isStaffRole =
      profile?.role === 'coach' || profile?.role === 'admin' || profile?.role === 'superadmin';
    const staffOnly = hasStaffMembership && !hasClientMembership;
    const ownsGymNotClient = hasOwnedFitEngineOrgs && !hasClientMembership;
    /** Rol en `profiles` dice staff pero memberships aún no reflejan cliente — evita quedar en cliente. */
    const profileStaffNoClientMembership = isStaffRole && !hasClientMembership;

    // eslint-disable-next-line no-console
    console.log('ROUTING_DEBUG ClientScreen guard', {
      userId: user?.id,
      activeAppMode,
      profileRole: profile?.role,
      hasStaffMembership,
      hasClientMembership,
      ownedOrgsCount: ownedOrganizations?.length ?? 0,
      orgsOwnedByUserCount: organizationsOwnedByUser?.length ?? 0,
      needsFitEngineSpaceSetup,
      staffOnly,
      ownsGymNotClient,
      profileStaffNoClientMembership,
      authNavigationReady,
      initialProfileSyncDone,
    });

    const modeIsClientish = activeAppMode === 'client' || activeAppMode == null;
    const mustLeaveClientPanel =
      modeIsClientish &&
      (staffOnly || ownsGymNotClient || profileStaffNoClientMembership);

    // Modo cliente (o null) pero la cuenta es solo staff / coach en perfil sin membresía cliente.
    if (mustLeaveClientPanel) {
      // eslint-disable-next-line no-console
      console.log('ROUTING_DEBUG ClientScreen → reset AdminLite', {
        reason: staffOnly
          ? 'staffOnly'
          : ownsGymNotClient
            ? 'ownsGymNotClient'
            : 'profileStaffNoClientMembership',
      });
      (async () => {
        try {
          if (persistActiveAppMode && user?.id) {
            await persistActiveAppMode('staff', user.id);
          }
        } catch (_) {}
        const staffRoute = needsFitEngineSpaceSetup
          ? { name: 'ConfiguraTuEspacio', params: { email: user?.email } }
          : { name: 'AdminLite' };
        if (navigationRef.isReady()) {
          navigationRef.resetRoot({ index: 0, routes: [staffRoute] });
        } else {
          navigation.reset({ index: 0, routes: [staffRoute] });
        }
      })();
      return;
    }

    if (activeAppMode === 'staff' && (hasOwnedFitEngineOrgs || isStaffRole)) {
      const staffRoute = needsFitEngineSpaceSetup
        ? { name: 'ConfiguraTuEspacio', params: { email: user?.email } }
        : { name: 'AdminLite' };
      if (navigationRef.isReady()) {
        navigationRef.resetRoot({ index: 0, routes: [staffRoute] });
      } else {
        navigation.reset({ index: 0, routes: [staffRoute] });
      }
    }
  }, [
    user?.id,
    user?.email,
    authNavigationReady,
    initialProfileSyncDone,
    activeAppMode,
    ownedOrganizations,
    organizationsOwnedByUser,
    needsFitEngineSpaceSetup,
    profile?.role,
    navigation,
    hasStaffMembership,
    hasClientMembership,
    persistActiveAppMode,
  ]);

  const resetToWelcome = () => {
    // DEBUG logout: ver qué rama se ejecuta
    // eslint-disable-next-line no-console
    console.log('🔁 ClientScreen.resetToWelcome: start', {
      navReady: navigationRef.isReady?.() || false,
    });

    // 1) Intentar reset global usando la ref del NavigationContainer
    if (navigationRef.isReady()) {
      try {
        // eslint-disable-next-line no-console
        console.log('🔁 ClientScreen.resetToWelcome: usando navigationRef.resetRoot');
        navigationRef.resetRoot({ index: 0, routes: [{ name: 'WelcomeGlobal' }] });
        return true;
      } catch {
        // seguir con los navegadores locales
        // eslint-disable-next-line no-console
        console.log('⚠️ ClientScreen.resetToWelcome: fallo resetRoot, probando navegadores locales');
      }
    }

    // 2) Fallback: recorrer padres (tabs -> stack)
    const navs = [navigation?.getParent?.()?.getParent?.(), navigation?.getParent?.(), navigation].filter(
      Boolean,
    );
    for (const nav of navs) {
      try {
        // eslint-disable-next-line no-console
        console.log('🔁 ClientScreen.resetToWelcome: nav.reset en', {
          hasParent: !!navigation?.getParent?.(),
        });
        nav.reset({ index: 0, routes: [{ name: 'WelcomeGlobal' }] });
        return true;
      } catch {
        // keep trying
      }
    }
    try {
      // eslint-disable-next-line no-console
      console.log('🔁 ClientScreen.resetToWelcome: usando safeNavigate a Welcome');
      return !!safeNavigate(['Welcome', 'WelcomeScreen']);
    } catch {
      // eslint-disable-next-line no-console
      console.log('❌ ClientScreen.resetToWelcome: todas las rutas fallaron');
      return false;
    }
  };

  const handleLogout = () => {
    // eslint-disable-next-line no-console
    console.log('🟡 ClientScreen.handleLogout: Alert de confirmación');
    Alert.alert(tStr('client_logout'), tStr('client_logout_confirm'), [
      { text: tStr('common_cancel'), style: 'cancel' },
      {
        text: tStr('common_exit'),
        style: 'destructive',
        onPress: () => {
          // ⚠️ No esperamos a que termine logout(): lo disparamos en background y forzamos navegación.
          // eslint-disable-next-line no-console
          console.log('▶️ ClientScreen.handleLogout: onPress -> logout() (fire-and-forget)');
          try {
            logout?.();
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('⚠️ ClientScreen.handleLogout: error al lanzar logout()', e?.message || e);
          }
          // eslint-disable-next-line no-console
          console.log('✅ ClientScreen.handleLogout: llamando resetToWelcome() inmediatamente');
          resetToWelcome();
        },
      },
    ]);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        scroll: {
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 80,
          paddingBottom: 40,
        },
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderWidth: 1,
          borderRadius: 22,
          padding: 18,
          marginBottom: 20,
        },
        headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
        avatarWrap: {
          width: 52,
          height: 52,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: hexToRgba(t.brand, 0.8),
          backgroundColor: t.boxBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          overflow: 'hidden',
        },
        avatarImg: { width: 52, height: 52, borderRadius: 26 },
        logoWrap: { marginBottom: 12, alignItems: 'flex-start' },
        logoImg: { width: 120, height: 36 },
        headerGreeting: { fontSize: 13, color: t.metallicGrey ?? t.subText, marginBottom: 4 },
        headerName: { fontSize: 22, fontWeight: '800', color: t.text },
        headerSub: { marginTop: 8, fontSize: 13, color: t.metallicGrey ?? t.subText },

        metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
        metricBox: {
          flex: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderWidth: 1,
          marginRight: 10,
          minHeight: 86,
        },
        metricBoxLast: { marginRight: 0 },
        metricLabel: { color: t.metallicGrey ?? t.subText, fontSize: 11 },
        metricValue: { color: t.text, fontSize: 15, fontWeight: 'bold' },
        metricHint: { marginTop: 6, color: t.placeholder, fontSize: 10, lineHeight: 14 },

        sectionTitle: { color: t.subText, fontSize: 16, fontWeight: 'bold', marginBottom: 10 },

        planBox: {
          borderRadius: 18,
          paddingVertical: 18,
          paddingHorizontal: 16,
          borderWidth: 1.5,
          borderColor: t.brand,
          backgroundColor: t.boxBg,
          alignItems: 'center',
          marginBottom: 12,
          ...(t.buttonGlow ? { shadowColor: t.logoCian ?? t.brand, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 } : {}),
        },
        planTitle: { color: t.text, fontSize: 17, fontWeight: '800' },
        planSubtitle: { color: t.subText, fontSize: 12, marginTop: 6, textAlign: 'center' },
        planDates: { marginTop: 10, color: t.placeholder, fontSize: 11, textAlign: 'center' },

        pillRow: { flexDirection: 'row', marginTop: 12 },
        planPillBtn: {
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: hexToRgba(t.brand, 0.8),
          backgroundColor: hexToRgba(t.brand, 0.12),
          marginHorizontal: 6,
          minWidth: 118,
          alignItems: 'center',
          ...(t.buttonGlow || {}),
        },
        planPillText: { color: t.primaryText, fontSize: 11, fontWeight: '700' },

        novedadesCaja: {
          borderRadius: 18,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderWidth: 1.5,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          marginBottom: 12,
        },
        novedadesTitle: {
          color: t.brandText ?? t.brand,
          fontSize: 13,
          fontWeight: '800',
          marginBottom: 6,
          letterSpacing: 0.8,
          textShadowColor: t.brandTextShadow ?? 'rgba(0,255,252,0.8)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 6,
        },
        novedadesTickerWrap: { minHeight: 24, justifyContent: 'center', overflow: 'hidden' },
        novedadesTickerText: {
          color: t.brandText ?? t.brand,
          fontSize: 15,
          fontWeight: '700',
          letterSpacing: 0.5,
          textShadowColor: t.brandTextShadow ?? 'rgba(0,255,252,0.7)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 4,
        },
        novedadesDots: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 6 },
        novedadesDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: hexToRgba(t.text, 0.3),
        },
        novedadesDotActive: { backgroundColor: t.brandText ?? t.brand },
        novedadesVerTodas: {
          color: t.brandText ?? t.brand,
          fontSize: 12,
          fontWeight: '700',
          marginTop: 8,
          textAlign: 'right',
          textShadowColor: t.brandTextShadow ?? 'rgba(0,255,252,0.5)',
          textShadowRadius: 2,
        },
        chatBadge: {
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: '#ff5a5a',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 5,
        },
        chatBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

        quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
        quickBtn: {
          flex: 1,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          paddingVertical: 16,
          paddingHorizontal: 12,
          marginRight: 10,
          alignItems: 'center',
        },
        quickBtnLast: { marginRight: 0 },
        quickIconWrap: {
          width: 36,
          height: 36,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: hexToRgba(t.brand, 0.6),
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          overflow: 'visible',
        },
        quickLabel: { color: t.text, fontWeight: '600', fontSize: 13, textAlign: 'center' },
        quickHint: { color: t.placeholder, fontSize: 11, marginTop: 4, textAlign: 'center' },

        secondaryBtn: {
          marginTop: 14,
          paddingVertical: 10,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          ...t.buttonPrimary,
          ...(t.buttonGlow || {}),
        },
        secondaryBtnText: { ...t.buttonPrimaryText, fontWeight: '600', fontSize: 14 },

        footerInfo: { marginTop: 4, fontSize: 11, color: t.placeholder, textAlign: 'center' },
      }),
    [t]
  );

  const planActivoDescripcion =
    planKey === 'all_access'
      ? tStr('client_plan_all_access_desc')
      : planKey
        ? tStr('client_plan_reserve_desc')
        : tStr('client_plan_choose_desc');

  return (
    <BackgroundWrapper screen="ClientScreen" plan={planObj || undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          {organization?.logo_url ? (
            <View style={styles.logoWrap}>
              <Image source={{ uri: organization.logo_url }} style={styles.logoImg} resizeMode="contain" />
            </View>
          ) : null}
          <View style={styles.headerRow}>
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={28} color={t.subText} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerGreeting}>{saludo}</Text>
              <Text style={styles.headerName}>{nombre}</Text>
              <Text style={styles.headerSub}>{tStr('client_welcome_panel')}</Text>
              {organization?.name ? (
                <Text style={[styles.headerSub, { marginTop: 2, opacity: 0.9 }]}>{organization.name}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.metricsRow}>
            <TouchableOpacity
              style={styles.metricBox}
              onPress={goPlanAbonoDetail}
              activeOpacity={0.85}
            >
              <Text style={styles.metricLabel}>{tStr('client_plan')}</Text>
              {planLoading ? (
                <View style={{ marginTop: 6 }}>
                  <ActivityIndicator color={t.brand} />
                </View>
              ) : (
                <Text style={styles.metricValue}>{planLabel}</Text>
              )}
              <Text style={styles.metricHint}>{planHintLine}</Text>
            </TouchableOpacity>

            <View style={[styles.metricBox, styles.metricBoxLast]}>
              <Text style={styles.metricLabel}>{tStr('client_apto_medico')}</Text>
              <Text style={styles.metricValue}>{aptoMedico ? tStr('client_apto_ok') : tStr('client_apto_pendiente')}</Text>
              <Text style={styles.metricHint}>{aptoMedico ? tStr('client_apto_ready') : tStr('client_apto_upload')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{tStr('client_plan_activo')}</Text>

          <View style={styles.planBox}>
            <Text style={styles.planTitle}>{planLabel}</Text>
            <Text style={styles.planSubtitle}>{planActivoDescripcion}</Text>

            {!!(startFmt || endFmt) && (
              <Text style={styles.planDates}>
                {startFmt ? `${tStr('client_abono_start')}: ${startFmt}` : ''}
                {startFmt && endFmt ? ' • ' : ''}
                {endFmt ? `${tStr('client_abono_end')}: ${endFmt}` : ''}
                {typeof daysLeft === 'number' ? ` • ${daysLeft} ${tStr('client_days')}` : ''}
              </Text>
            )}

            <View style={styles.pillRow}>
              <TouchableOpacity style={styles.planPillBtn} activeOpacity={0.9} onPress={goCalendario}>
                <Text style={styles.planPillText}>{tStr('client_calendario')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.planPillBtn} activeOpacity={0.9} onPress={goTrabajoHoy}>
                <Text style={styles.planPillText}>{tStr('client_trabajo_hoy')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footerInfo}>{tStr('client_reservas_hint')}</Text>
        </View>

        <TouchableOpacity
          style={styles.novedadesCaja}
          onPress={goNovedades}
          onPressIn={() => { novedadesTickerPausedRef.current = true; }}
          onPressOut={() => { novedadesTickerPausedRef.current = false; }}
          activeOpacity={0.9}
        >
          <Text style={styles.novedadesTitle}>{tStr('client_novedades')}</Text>
          {novedadesLoading ? (
            <View style={styles.novedadesTickerWrap}>
              <ActivityIndicator size="small" color={t.brand} />
            </View>
          ) : novedades.length === 0 ? (
            <Text style={styles.novedadesTickerText}>{tStr('client_sin_novedades')}</Text>
          ) : (
            <>
              <View style={styles.novedadesTickerWrap}>
                <Animated.View
                  style={{
                    flexDirection: 'row',
                    transform: [
                      {
                        translateX: novedadesMarqueeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -180],
                        }),
                      },
                    ],
                  }}
                >
                  <Text style={styles.novedadesTickerText} numberOfLines={1}>
                    {currentNovedadTitle}
                    {'  ·  '}
                  </Text>
                  <Text style={styles.novedadesTickerText} numberOfLines={1}>
                    {currentNovedadTitle}
                  </Text>
                </Animated.View>
              </View>
              {novedades.length > 1 && (
                <View style={styles.novedadesDots}>
                  {novedades.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.novedadesDot, i === novedadesTickerIndex && styles.novedadesDotActive]}
                    />
                  ))}
                </View>
              )}
            </>
          )}
          <Text style={styles.novedadesVerTodas}>{tStr('client_ver_todas')} ›</Text>
        </TouchableOpacity>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{tStr('client_quick_access')}</Text>

          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={goPerfil} activeOpacity={0.9}>
              <View style={styles.quickIconWrap}>
                <Ionicons name="person-circle-outline" size={22} color={t.brand} />
              </View>
              <Text style={styles.quickLabel}>{tStr('client_my_profile')}</Text>
              <Text style={styles.quickHint}>{tStr('client_my_profile_hint')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.quickBtn, styles.quickBtnLast]} onPress={goChat} activeOpacity={0.9}>
              <View style={styles.quickIconWrap}>
                <Ionicons name="chatbubbles-outline" size={20} color={t.brand} />
                {unreadChatCount > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickLabel}>{tStr('config_notif_messages')}</Text>
              <Text style={styles.quickHint}>{tStr('client_chat_hint')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 18 }]} onPress={handleLogout}>
            <Text style={styles.secondaryBtnText}>{tStr('client_logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}