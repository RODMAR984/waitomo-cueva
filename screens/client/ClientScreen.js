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
  Alert,
  Image,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import useUiSurface from '../../hooks/useUiSurface';
import ScreenShell from '../../components/ScreenShell';
import { colors } from '../../theme/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { supabase } from '../../supabaseClient';
import { navigationRef, resetNavigationRoot } from '../../navigationRef';
import { normalizePlanKey } from '../../utils/planKeyNormalize';
import { formatYmdLocal } from '../../utils/formatYmdLocal';
import { normalizeSlotLabel } from '../../utils/freeClassGrantStorage';
import {
  WEB_CONTENT_MAX_WIDTH,
} from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import {
  evaluateTrabajoHoyButton,
  evaluateCalendarioAccess,
  evaluateClientCommunityAccess,
  isUserAbonoActive,
  abonoCoversUserPlan,
} from '../../utils/clientWorkoutEntitlement';
import { clearFreeClassGrant } from '../../utils/freeClassGrantStorage';
import { FREE_CLASS_CANCEL_NOTICE_HOURS } from '../../utils/freeClassPolicy';
import { cancelTrialClassGrantServer, resolveFreeClassGrant } from '../../services/booking/trialClassGrant';
import { reportError, trackEvent } from '../../utils/observability';
import NeoPanel from '../../components/NeoPanel';

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

const PLAN_ACTIVITY_ORDER = Object.keys(PLAN_LABELS);

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

const calcDaysUntil = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
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
  const isWeb = Platform.OS === 'web';
  const { isDesktopWeb: isWebWide } = useUiSurface();
  const contentMaxWidth = isWebWide ? WEB_CONTENT_MAX_WIDTH : isWeb ? 900 : 760;
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const navigation = useNavigation();

  const {
    profile,
    user,
    logout,
    activePlanId,
    organization,
    activeAppMode,
    ownedOrganizations,
    organizationsOwnedByUser,
    needsFitEngineSpaceSetup,
    authNavigationReady,
    initialProfileSyncDone,
    refreshOrganization,
    hasStaffMembership,
    hasClientMembership,
    persistActiveAppMode,
    updateProfile,
    userPlans,
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
  const [homeNudge, setHomeNudge] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          if (!user?.id || !profile?.organization_id) {
            if (!cancelled) setHomeNudge(null);
            return;
          }
          const { data, error } = await supabase
            .from('in_app_nudges')
            .select('id, body, created_at')
            .eq('user_id', user.id)
            .eq('organization_id', profile.organization_id)
            .is('read_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (cancelled) return;
          if (error) {
            setHomeNudge(null);
            return;
          }
          setHomeNudge(data || null);
        } catch {
          if (!cancelled) setHomeNudge(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id, profile?.organization_id]),
  );

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

  // Si hay plan en la app (contexto / storage) pero profiles.plan_actual sigue null, guardarlo en Supabase (chat RLS, etc.)
  useEffect(() => {
    if (!user?.id || typeof updateProfile !== 'function') return;
    if (initialProfileSyncDone !== true || planLoading) return;
    if (!planKey) return;
    const db = (profile?.plan_actual ?? profile?.planActual ?? '').trim();
    if (db) return;
    updateProfile({ plan_actual: planKey });
  }, [
    user?.id,
    planKey,
    planLoading,
    profile?.plan_actual,
    profile?.planActual,
    initialProfileSyncDone,
    updateProfile,
  ]);

  // ✅ abonos activos: fechas/estado por actividad (el plan mostrado viene de plan_actual / activePlanId)
  const [userAbonosActive, setUserAbonosActive] = useState([]);
  const [abonoLoading, setAbonoLoading] = useState(true);
  const [freeClassGrant, setFreeClassGrant] = useState(null);
  const [planSwitching, setPlanSwitching] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const startedAt = Date.now();
      try {
        if (!user?.id) {
          if (alive) {
            setUserAbonosActive([]);
            setAbonoLoading(false);
          }
          return;
        }

        // eslint-disable-next-line no-console
        console.log('🔄 ClientScreen: cargando user_abonos para user', user.id);

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
          .limit(25);

        const raced = await Promise.race([queryPromise, timeoutPromise]);

        if (timeoutId) clearTimeout(timeoutId);

        if (raced instanceof Error) {
          throw raced;
        }

        const { data, error } = raced || {};

        if (error) {
          // eslint-disable-next-line no-console
          console.log('❌ ClientScreen: error cargando user_abonos:', error.message);
          throw error;
        }

        const list = Array.isArray(data)
          ? data.filter((r) => {
              const s = String(r?.status || '').toLowerCase();
              return s === 'active' || s === 'pending';
            })
          : [];
        if (alive) {
          setUserAbonosActive(list);
          setAbonoLoading(false);
        }
        trackEvent('client_abonos_load_success', {
          durationMs: Date.now() - startedAt,
          userId: user?.id || null,
          activeCount: list.length,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('❌ ClientScreen: catch en carga de abono:', e?.message || e);
        reportError('client_abonos_load_failed', e, {
          durationMs: Date.now() - startedAt,
          userId: user?.id || null,
        });
        if (alive) {
          setUserAbonosActive([]);
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

  const orgForEntitlement = organization?.id || profile?.organization_id || null;

  /** Solo planes contratados (abonos activos) + clase de prueba agendada; no el catálogo de la org. */
  const contractedKeys = useMemo(() => {
    const set = new Set();
    userAbonosActive.forEach((r) => {
      const k = normalizePlanKey(r.plan_id);
      if (k) set.add(k);
    });
    (Array.isArray(userPlans) ? userPlans : []).forEach((r) => {
      const k = normalizePlanKey(r?.plan_id);
      if (k) set.add(k);
    });
    if (freeClassGrant?.planCanonId) {
      const g = normalizePlanKey(freeClassGrant.planCanonId);
      if (g) set.add(g);
    }
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ia = PLAN_ACTIVITY_ORDER.indexOf(a);
      const ib = PLAN_ACTIVITY_ORDER.indexOf(b);
      const sa = ia === -1 ? 999 : ia;
      const sb = ib === -1 ? 999 : ib;
      if (sa !== sb) return sa - sb;
      return String(a).localeCompare(String(b));
    });
    return arr;
  }, [userAbonosActive, userPlans, freeClassGrant]);

  /**
   * Plan con el que operamos en UI y abono: si profile apunta a algo no contratado, caemos al primero contratado.
   */
  const effectivePlanKey = useMemo(() => {
    if (!planKey) return contractedKeys[0] || null;
    if (contractedKeys.length === 0) return planKey;
    if (contractedKeys.includes(planKey)) return planKey;
    return contractedKeys[0];
  }, [contractedKeys, planKey]);

  const canonId = effectivePlanKey ? (PLAN_CANON_ID[effectivePlanKey] || effectivePlanKey) : null;
  const planLabel = effectivePlanKey
    ? (PLAN_LABELS[effectivePlanKey] || String(effectivePlanKey).toUpperCase())
    : tStr('client_no_plan');
  const planObj = canonId ? { id: canonId, title: planLabel, active: true } : null;

  const abonoRow = useMemo(() => {
    const pk = effectivePlanKey;
    if (!pk) {
      const activeAny = userAbonosActive.find((r) => isUserAbonoActive(r));
      if (activeAny) return activeAny;
      return userAbonosActive[0] || null;
    }
    const rows = userAbonosActive.filter((r) => abonoCoversUserPlan(r, pk));
    if (rows.length === 0) return null;
    const active = rows.find((r) => isUserAbonoActive(r));
    return active || rows[0];
  }, [userAbonosActive, effectivePlanKey]);

  // Perfil desfasado (plan_actual = yoga pero solo abono cross): alinear a un plan contratado.
  useEffect(() => {
    if (!user?.id || typeof updateProfile !== 'function') return;
    if (planLoading || abonoLoading) return;
    if (contractedKeys.length === 0) return;
    if (!planKey || contractedKeys.includes(planKey)) return;
    const next = contractedKeys[0];
    if (!next) return;
    updateProfile({ plan_actual: next });
  }, [
    user?.id,
    planKey,
    contractedKeys,
    planLoading,
    abonoLoading,
    updateProfile,
  ]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const g = await resolveFreeClassGrant(user?.id);
        if (alive) setFreeClassGrant(g);
      })();
      return () => {
        alive = false;
      };
    }, [user?.id]),
  );

  useEffect(() => {
    if (isUserAbonoActive(abonoRow)) {
      clearFreeClassGrant();
      setFreeClassGrant(null);
    }
  }, [abonoRow?.id, abonoRow?.status, abonoRow?.end_date]);

  // ---------------------------------------------
  // Novedades (gym_news) — preview con ticker, timeout y fallback
  // ---------------------------------------------
  const [novedades, setNovedades] = useState([]);
  const [novedadesLoading, setNovedadesLoading] = useState(true);
  const [novedadesTickerIndex, setNovedadesTickerIndex] = useState(0);
  const novedadesTickerPausedRef = useRef(false);
  const novedadesMarqueeAnim = useRef(new Animated.Value(0)).current;
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [myReservations, setMyReservations] = useState([]);

  const communityAccess = useMemo(
    () =>
      evaluateClientCommunityAccess({
        planCanonKey: effectivePlanKey,
        organizationId: orgForEntitlement,
        abonoRow,
        abonoLoading,
        freeClassGrant,
      }),
    [effectivePlanKey, orgForEntitlement, abonoRow, abonoLoading, freeClassGrant],
  );

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
    return `${abonoStatusLabel} • ${tStr('client_abono_tap_programs_hint')}`;
  })();

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

  const goPlanSelector = useCallback(() => {
    safeNavigate(['PlanSelector', 'PlanSelectorScreen']);
  }, [safeNavigate]);

  /** Caja "Plan": lista de programas → PlanSelector abre abonos (y clase de prueba) directo; PlanDetail queda por enlaces puntuales. */
  const goPlanHub = useCallback(() => {
    safeNavigate(['PlanSelector', 'PlanSelectorScreen'], {
      clientHomeContext: {
        planKey: canonId,
        planLabel,
        planHintLine,
        abonoRow: abonoRow || null,
      },
    });
  }, [safeNavigate, canonId, planLabel, planHintLine, abonoRow]);

  const switchActivity = useCallback(
    async (canonRaw) => {
      const canon = normalizePlanKey(canonRaw);
      if (!canon || canon === effectivePlanKey || typeof updateProfile !== 'function') return;
      setPlanSwitching(true);
      try {
        await updateProfile({ plan_actual: canon });
      } catch (e) {
        Alert.alert(tStr('client_plan_switch_error_title'), tStr('client_plan_switch_error_body'));
      } finally {
        setPlanSwitching(false);
      }
    },
    [effectivePlanKey, updateProfile, tStr]
  );

  const cycleActivity = useCallback(
    (delta) => {
      if (contractedKeys.length < 2) return;
      const ix = contractedKeys.indexOf(effectivePlanKey);
      const base = ix >= 0 ? ix : 0;
      const n = contractedKeys.length;
      const nextIx = (base + delta + n * 10) % n;
      switchActivity(contractedKeys[nextIx]);
    },
    [contractedKeys, effectivePlanKey, switchActivity]
  );

  const goCalendario = (reservation = null) => {
    const targetPlanKey = normalizePlanKey(reservation?.planKey) || canonId;
    const targetPlanLabel = PLAN_LABELS[targetPlanKey] || String(targetPlanKey || '').toUpperCase();
    const targetPlanObj = targetPlanKey
      ? { id: targetPlanKey, title: targetPlanLabel, active: true }
      : planObj;
    if (!targetPlanObj) {
      Alert.alert(tStr('client_no_plan'), tStr('client_no_plan_message'));
      return;
    }
    if (!reservation) {
      const cal = evaluateCalendarioAccess({
        planCanonKey: effectivePlanKey,
        organizationId: orgForEntitlement,
        abonoRow,
        abonoLoading,
        freeClassGrant,
      });
      if (!cal.ok) {
        if (cal.reason === 'loading') return;
        trackEvent('client_calendario_blocked', {
          reason: cal.reason || 'unknown',
          planKey: effectivePlanKey || null,
        });
        Alert.alert(tStr('client_calendario_locked_title'), tStr('client_calendario_locked_body'), [
          { text: tStr('common_ok'), style: 'cancel' },
          {
            text: tStr('client_entitlement_go_pay'),
            onPress: () => safeNavigate(['AbonosPases', 'AbonosPasesScreen']),
          },
        ]);
        return;
      }
    }
    const ok = safeNavigate(['Calendario', 'CalendarioScreen'], {
      plan: targetPlanObj,
      planKey: targetPlanKey,
      prefillDate: reservation?.date || null,
      prefillSlot: reservation?.slot || null,
      userData: {
        hasMedicalCertificate: aptoMedico,
        createdAt: profile?.created_at || null,
      },
    });
    if (ok) {
      trackEvent('client_open_calendario', {
        fromReservation: !!reservation,
        planKey: targetPlanKey || null,
      });
    }
    if (!ok) Alert.alert(tStr('client_route_not_found'), tStr('client_calendario_missing'));
  };

  const goManageFreeClass = () => {
    if (!planObj) {
      Alert.alert(tStr('client_no_plan'), tStr('client_no_plan_message'));
      return;
    }
    const ok = safeNavigate(['FreeClassRequest', 'FreeClassRequestScreen'], { plan: planObj });
    if (!ok) Alert.alert(tStr('client_route_not_found'), tStr('client_freeclass_missing'));
  };

  const handleCancelFreeClass = () => {
    const g = freeClassGrant;
    if (!g?.fechaYmd || !g.slotLabel || !g.organizationId) {
      Alert.alert(tStr('freeclass_cancel_error_title'), tStr('freeclass_cancel_error_body'));
      return;
    }
    Alert.alert(
      tStr('freeclass_cancel_confirm_title'),
      tStr('freeclass_cancel_confirm_body').replace(
        '{{hours}}',
        String(FREE_CLASS_CANCEL_NOTICE_HOURS),
      ),
      [
      { text: tStr('common_cancel'), style: 'cancel' },
      {
        text: tStr('freeclass_cancel_confirm_cta'),
        style: 'destructive',
        onPress: async () => {
          const res = await cancelTrialClassGrantServer({
            organizationId: g.organizationId,
            planCanonId: g.planCanonId,
            fechaYmd: g.fechaYmd,
            slotLabel: g.slotLabel,
            minNoticeHours: FREE_CLASS_CANCEL_NOTICE_HOURS,
          });
          if (!res.ok) {
            if (res.reason === 'too_late_to_cancel') {
              Alert.alert(
                tStr('freeclass_cancel_late_title'),
                tStr('freeclass_cancel_late_body').replace(
                  '{{hours}}',
                  String(FREE_CLASS_CANCEL_NOTICE_HOURS),
                ),
              );
              return;
            }
            Alert.alert(tStr('freeclass_cancel_error_title'), tStr('freeclass_cancel_error_body'));
            return;
          }
          await clearFreeClassGrant();
          setFreeClassGrant(null);
          Alert.alert(tStr('freeclass_cancel_done_title'), tStr('freeclass_cancel_done_body'));
        },
      },
    ]);
  };

  const goTrabajoHoy = () => {
    if (!planObj || !effectivePlanKey) {
      Alert.alert(tStr('client_no_plan'), tStr('client_no_plan_message'), [
        { text: tStr('common_cancel'), style: 'cancel' },
        {
          text: tStr('client_entitlement_go_plans'),
          onPress: () => safeNavigate(['PlanSelector', 'PlanSelectorScreen']),
        },
      ]);
      return;
    }
    const th = evaluateTrabajoHoyButton({
      planCanonKey: effectivePlanKey,
      organizationId: orgForEntitlement,
      abonoRow,
      abonoLoading,
      freeClassGrant,
    });
    if (th.reason === 'loading') return;
    if (!th.ok) {
      const g = freeClassGrant;
      const gPlanOk = g && normalizePlanKey(g.planCanonId) === normalizePlanKey(effectivePlanKey);
      const gOrgOk =
        !g?.organizationId ||
        !orgForEntitlement ||
        String(g.organizationId) === String(orgForEntitlement);
      const todayYmd = formatYmdLocal(new Date());
      if (g && gPlanOk && gOrgOk && g.fechaYmd && g.fechaYmd !== todayYmd) {
        const d = new Date(`${g.fechaYmd}T12:00:00`);
        const dateStr = d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        Alert.alert(
          tStr('client_free_class_other_day_title'),
          tStr('client_free_class_other_day_body')
            .replace('{{date}}', dateStr)
            .replace('{{time}}', g.slotLabel || ''),
        );
        return;
      }
      Alert.alert(tStr('client_entitlement_no_sub_title'), tStr('client_entitlement_no_sub_body'), [
        { text: tStr('common_cancel'), style: 'cancel' },
        {
          text: tStr('client_entitlement_go_plans'),
          onPress: () => safeNavigate(['PlanSelector', 'PlanSelectorScreen']),
        },
        {
          text: tStr('client_entitlement_go_pay'),
          onPress: () => safeNavigate(['AbonosPases', 'AbonosPasesScreen']),
        },
      ]);
      trackEvent('client_trabajo_hoy_blocked', {
        reason: th.reason || 'not_allowed',
        planKey: effectivePlanKey || null,
      });
      return;
    }
    const planValue = effectivePlanKey
      ? (PLAN_KEY_TO_ADMIN_VALUE[effectivePlanKey] || effectivePlanKey)
      : canonId;
    const fechaNav = th.fechaYmd || formatYmdLocal(new Date());
    const navParams = {
      from: 'ClientScreen',
      plan: { ...planObj, nombre: planLabel, planValue },
      planKey: canonId,
      planValue,
      fecha: fechaNav,
      userData: {
        hasMedicalCertificate: aptoMedico,
        createdAt: profile?.created_at || null,
      },
    };
    if (th.horario) {
      navParams.horario = th.horario;
    }
    const ok = safeNavigate(['TrabajoDelDia', 'TrabajoDelDiaScreen'], navParams);
    if (ok) {
      trackEvent('client_open_trabajo_hoy', {
        planKey: effectivePlanKey || null,
        fecha: navParams.fecha || null,
      });
    }
    if (!ok) Alert.alert(tStr('client_route_not_found'), tStr('client_trabajo_missing'));
  };

  const goPerfil = () => {
    safeNavigate(['PerfilUsuario', 'PerfilUsuarioScreen', 'Perfil'], {
      plan: planObj || undefined,
      planKey: canonId,
    });
  };

  const goChat = useCallback(() => {
    if (communityAccess.reason === 'loading') return;
    if (!communityAccess.ok) {
      trackEvent('client_chat_blocked', {
        reason: communityAccess.reason || 'not_allowed',
      });
      Alert.alert(tStr('client_community_locked_title'), tStr('client_community_locked_body'), [
        { text: tStr('common_ok'), style: 'cancel' },
        {
          text: tStr('client_entitlement_go_pay'),
          onPress: () => safeNavigate(['AbonosPases', 'AbonosPasesScreen']),
        },
        {
          text: tStr('client_entitlement_go_plans'),
          onPress: () => safeNavigate(['PlanSelector', 'PlanSelectorScreen']),
        },
      ]);
      return;
    }
    // Staff: sigue viendo todos los canales.
    if (hasStaffMembership) {
      safeNavigate(['ChatCanales', 'ChatCanalesScreen']);
      return;
    }
    const orgN = organization?.id ?? profile?.organization_id ?? null;
    const ctx =
      effectivePlanKey ||
      normalizePlanKey(activePlanId) ||
      normalizePlanKey(profile?.plan_actual ?? profile?.planActual);
    if (!orgN || !ctx) {
      safeNavigate(['ChatCanales', 'ChatCanalesScreen']);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('chat_channels')
          .select('id, name, plan_id')
          .eq('organization_id', orgN);
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const match = rows.find((r) => normalizePlanKey(r.plan_id) === ctx);
        if (match) {
          const ok = safeNavigate(['Chat', 'ChatScreen'], {
            channelId: match.id,
            channelName: match.name || match.plan_id,
          });
          if (ok) return;
        }
      } catch {
        reportError('client_open_chat_failed', new Error('open_chat_failed'));
        /* ir a lista */
      }
      safeNavigate(['ChatCanales', 'ChatCanalesScreen']);
    })();
  }, [
    communityAccess.ok,
    communityAccess.reason,
    hasStaffMembership,
    organization?.id,
    profile?.organization_id,
    effectivePlanKey,
    activePlanId,
    profile?.plan_actual,
    profile?.planActual,
    safeNavigate,
    tStr,
  ]);

  const goDirectory = useCallback(() => {
    try {
      navigation.navigate('Directory');
    } catch {
      safeNavigate(['PublicDirectory', 'PublicDirectoryScreen']);
    }
  }, [navigation, safeNavigate]);

  useEffect(() => {
    if (isWebWide) {
      setNovedades([]);
      setNovedadesLoading(false);
      return undefined;
    }
    let alive = true;
    const timeoutId = setTimeout(() => {
      if (alive && novedadesLoading) setNovedadesLoading(false);
    }, 5000);
    (async () => {
      const startedAt = Date.now();
      try {
        if (abonoLoading) return;
        if (!communityAccess.ok) {
          if (alive) {
            setNovedades([]);
            setNovedadesLoading(false);
          }
          return;
        }
        const orgN = organization?.id || profile?.organization_id || null;
        if (!orgN) {
          if (alive) setNovedades([]);
          return;
        }
        const { data, error } = await supabase
          .from('gym_news')
          .select('id, title, body, image_url, tag, pinned, created_at')
          .eq('organization_id', orgN)
          .eq('is_active', true)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5);
        if (!alive) return;
        if (error) throw error;
        const nextNews = Array.isArray(data) ? data : [];
        setNovedades(nextNews);
        trackEvent('client_news_load_success', {
          durationMs: Date.now() - startedAt,
          organizationId: orgN || null,
          count: nextNews.length,
        });
      } catch (e) {
        reportError('client_news_load_failed', e, {
          durationMs: Date.now() - startedAt,
          organizationId: organization?.id || profile?.organization_id || null,
        });
        if (alive) setNovedades([]);
      } finally {
        if (alive) setNovedadesLoading(false);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timeoutId);
    };
  }, [organization?.id, profile?.organization_id, abonoLoading, communityAccess.ok, isWebWide]);

  const aptoTickerItem = useMemo(() => {
    if (!aptoMedico) {
      return { id: 'apto:pending', kind: 'apto', title: tStr('client_apto_ticker_pending') };
    }
    const days = calcDaysUntil(profile?.apto_medico_expires_at);
    if (days == null) {
      return { id: 'apto:ok', kind: 'apto', title: tStr('client_apto_ticker_ok_no_expiry') };
    }
    if (days < 0) {
      return {
        id: 'apto:expired',
        kind: 'apto',
        title: tStr('client_apto_ticker_expired').replace('{{n}}', String(Math.abs(days))),
      };
    }
    if (days <= 15) {
      return {
        id: 'apto:expiring',
        kind: 'apto',
        title: tStr('client_apto_ticker_expiring').replace('{{n}}', String(days)),
      };
    }
    return {
      id: 'apto:ok_days',
      kind: 'apto',
      title: tStr('client_apto_ticker_ok_days').replace('{{n}}', String(days)),
    };
  }, [aptoMedico, profile?.apto_medico_expires_at, tStr]);
  const tickerItems = useMemo(
    () => [aptoTickerItem, ...(Array.isArray(novedades) ? novedades : [])],
    [aptoTickerItem, novedades],
  );
  const currentNovedadTitle = tickerItems[novedadesTickerIndex]?.title || '';

  const goNovedades = useCallback(() => {
    const current = tickerItems[novedadesTickerIndex];
    if (current?.kind === 'apto') {
      safeNavigate(['PerfilUsuario', 'PerfilUsuarioScreen', 'Perfil'], {
        plan: planObj || undefined,
        planKey: canonId,
      });
      return;
    }
    if (communityAccess.reason === 'loading') return;
    if (!communityAccess.ok) {
      Alert.alert(tStr('client_community_locked_title'), tStr('client_community_locked_body'), [
        { text: tStr('common_ok'), style: 'cancel' },
        {
          text: tStr('client_entitlement_go_pay'),
          onPress: () => safeNavigate(['AbonosPases', 'AbonosPasesScreen']),
        },
        {
          text: tStr('client_entitlement_go_plans'),
          onPress: () => safeNavigate(['PlanSelector', 'PlanSelectorScreen']),
        },
      ]);
      return;
    }
    const params = current?.id ? { focusId: current.id } : undefined;
    safeNavigate(['Novedades', 'NovedadesScreen'], params);
  }, [communityAccess.ok, communityAccess.reason, tickerItems, novedadesTickerIndex, safeNavigate, tStr, planObj, canonId]);

  useEffect(() => {
    if (isWebWide) return undefined;
    if (tickerItems.length <= 1) return undefined;
    const id = setInterval(() => {
      if (novedadesTickerPausedRef.current) return;
      setNovedadesTickerIndex((i) => (i + 1) % tickerItems.length);
    }, 3500);
    return () => clearInterval(id);
  }, [tickerItems.length, isWebWide]);

  useEffect(() => {
    setNovedadesTickerIndex((prev) => (prev >= tickerItems.length ? 0 : prev));
  }, [tickerItems.length]);

  // Marquee: scroll automático del ticker actual
  useEffect(() => {
    if (isWebWide) return undefined;
    if (!currentNovedadTitle || novedadesTickerPausedRef.current) return undefined;
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
  }, [currentNovedadTitle, novedadesTickerIndex, isWebWide, novedadesMarqueeAnim]);

  // Contador de mensajes sin leer (desde última vez que abrió el chat)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id || !effectivePlanKey) {
        if (alive) setUnreadChatCount(0);
        return;
      }
      if (abonoLoading || !communityAccess.ok) {
        if (alive) setUnreadChatCount(0);
        return;
      }
      try {
        const lastOpen = await AsyncStorage.getItem(CHAT_LAST_OPEN);
        if (!lastOpen) {
          if (alive) setUnreadChatCount(0);
          return;
        }
        const orgChat = organization?.id || profile?.organization_id || null;
        if (!orgChat) {
          if (alive) setUnreadChatCount(0);
          return;
        }
        let chQuery = supabase.from('chat_channels').select('id').eq('organization_id', orgChat);
        if (effectivePlanKey && effectivePlanKey !== 'all_access') {
          chQuery = chQuery.eq('plan_id', effectivePlanKey);
        }
        const { data: channels } = await chQuery;
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
  }, [user?.id, effectivePlanKey, organization?.id, profile?.organization_id, abonoLoading, communityAccess.ok]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (!user?.id) {
          if (alive) setMyReservations([]);
          return;
        }
        const orgId = organization?.id || profile?.organization_id || null;
        if (!orgId) {
          if (alive) setMyReservations([]);
          return;
        }
        const today = formatYmdLocal(new Date());
        try {
          const [classRes, trialRes] = await Promise.all([
            supabase
              .from('class_bookings')
              .select('id, plan_key, session_date, slot_label, status')
              .eq('organization_id', orgId)
              .eq('user_id', user.id)
              .eq('status', 'scheduled')
              .gte('session_date', today)
              .order('session_date', { ascending: true })
              .order('slot_label', { ascending: true })
              .limit(10),
            supabase
              .from('trial_class_grants')
              .select('id, plan_canon_id, fecha_clase, slot_label, status')
              .eq('organization_id', orgId)
              .eq('user_id', user.id)
              .eq('status', 'scheduled')
              .gte('fecha_clase', today)
              .order('fecha_clase', { ascending: true })
              .order('slot_label', { ascending: true })
              .limit(10),
          ]);
          if (!alive) return;
          const paidRows = Array.isArray(classRes?.data)
            ? classRes.data.map((r) => ({
                id: `class:${r.id}`,
                planKey: normalizePlanKey(r.plan_key),
                date: String(r.session_date || ''),
                slot: normalizeSlotLabel(r.slot_label) || '',
                source: 'class',
              }))
            : [];
          const trialRows = Array.isArray(trialRes?.data)
            ? trialRes.data.map((r) => ({
                id: `trial:${r.id}`,
                planKey: normalizePlanKey(r.plan_canon_id),
                date: String(r.fecha_clase || ''),
                slot: normalizeSlotLabel(r.slot_label) || '',
                source: 'trial',
              }))
            : [];
          const merged = [...paidRows, ...trialRows]
            .filter((r) => r.date && r.slot)
            .sort((a, b) => {
              if (a.date !== b.date) return a.date.localeCompare(b.date);
              return a.slot.localeCompare(b.slot);
            })
            .slice(0, 12);
          setMyReservations(merged);
        } catch {
          if (alive) setMyReservations([]);
        }
      })();
      return () => {
        alive = false;
      };
    }, [user?.id, organization?.id, profile?.organization_id]),
  );

  // Si hay user pero no perfil (cuenta borrada o sin completar), ir a completar registro.
  useEffect(() => {
    if (!user?.id) return;
    if (initialProfileSyncDone === false) return;
    if (profile?.id) return;
    if (!navigationRef.isReady()) return;
    resetNavigationRoot({ index: 0, routes: [{ name: 'RegistroInicial' }] });
  }, [user?.id, profile?.id, initialProfileSyncDone]);

  // Perfil con gym pero org aún no hidratada → reintentar (evita panel “fantasma” tras reabrir).
  useEffect(() => {
    const profOrg = profile?.organization_id && String(profile.organization_id).trim();
    if (!user?.id || !profOrg || organization?.id === profOrg) return;
    if (initialProfileSyncDone === false) return;
    if (typeof refreshOrganization !== 'function') return;
    void refreshOrganization(profOrg);
  }, [
    user?.id,
    profile?.organization_id,
    organization?.id,
    initialProfileSyncDone,
    refreshOrganization,
  ]);

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
        } catch {
          void 0;
        }
        const hasStaffOrgRoutingHint =
          hasStaffMembership ||
          (ownedOrganizations?.length || 0) > 0 ||
          (organizationsOwnedByUser?.length || 0) > 0 ||
          !!(profile?.organization_id && String(profile.organization_id).trim());
        const staffNeedsConfigure =
          needsFitEngineSpaceSetup && !hasStaffOrgRoutingHint;
        const staffRoute = staffNeedsConfigure
          ? { name: 'FitEngineSpaceIntro', params: { email: user?.email } }
          : { name: 'AdminLite' };
        if (navigationRef.isReady() && resetNavigationRoot({ index: 0, routes: [staffRoute] })) {
          return;
        }
        navigation.reset({ index: 0, routes: [staffRoute] });
      })();
      return;
    }

    if (activeAppMode === 'staff' && (hasOwnedFitEngineOrgs || isStaffRole)) {
      const hasStaffOrgRoutingHint =
        hasStaffMembership ||
        (ownedOrganizations?.length || 0) > 0 ||
        (organizationsOwnedByUser?.length || 0) > 0 ||
        !!(profile?.organization_id && String(profile.organization_id).trim());
      const staffNeedsConfigure = needsFitEngineSpaceSetup && !hasStaffOrgRoutingHint;
      const staffRoute = staffNeedsConfigure
        ? { name: 'FitEngineSpaceIntro', params: { email: user?.email } }
        : { name: 'AdminLite' };
      if (navigationRef.isReady() && resetNavigationRoot({ index: 0, routes: [staffRoute] })) {
        return;
      }
      navigation.reset({ index: 0, routes: [staffRoute] });
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
    if (navigationRef.isReady() && resetNavigationRoot({ index: 0, routes: [{ name: 'WelcomeGlobal' }] })) {
      return true;
    }

    // Fallback: recorrer padres (tabs -> stack)
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
      return !!safeNavigate(['WelcomeGlobal']);
    } catch {
      // eslint-disable-next-line no-console
      console.log('❌ ClientScreen.resetToWelcome: todas las rutas fallaron');
      return false;
    }
  };

  const runLogoutAndWelcome = async () => {
    try {
      if (logout) await logout();
      trackEvent('auth_logout_requested', { source: 'client_screen' });
    } catch (e) {
      reportError('auth_logout_request_failed', e, { source: 'client_screen' });
    }
    resetToWelcome();
  };

  const handleLogout = () => {
    const proceed = () => {
      void runLogoutAndWelcome();
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const msg = `${tStr('client_logout')}\n\n${tStr('client_logout_confirm')}`;
      if (window.confirm(msg)) proceed();
      return;
    }
    Alert.alert(tStr('client_logout'), tStr('client_logout_confirm'), [
      { text: tStr('common_cancel'), style: 'cancel' },
      { text: tStr('common_exit'), style: 'destructive', onPress: proceed },
    ]);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        scroll: {
          width: '100%',
          alignSelf: 'center',
          maxWidth: contentMaxWidth,
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingTop: 80,
          paddingBottom: 40,
        },
        mainGrid: {
          width: '100%',
          flexDirection: isWebWide ? 'row' : 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          gap: isWebWide ? 16 : 12,
        },
        mainColPrimary: {
          flex: isWebWide ? 1 : undefined,
          flexShrink: 0,
          gap: 12,
        },
        mainColSecondary: {
          flex: isWebWide ? 1 : undefined,
          flexShrink: 0,
          gap: 12,
        },
        panelEqualHeight: isWebWide ? { minHeight: 420 } : null,
        panel: {
          backgroundColor: t.boxBg,
          borderRadius: MOBILE_RADII.lg,
          padding: isWebWide ? MOBILE_SPACING.xl : 18,
          marginBottom: 0,
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
        headerGreeting: { fontSize: MOBILE_TYPE.body, color: t.metallicGrey ?? t.subText, marginBottom: 4 },
        headerName: { fontSize: MOBILE_TYPE.title, fontWeight: '800', color: t.text },
        headerSub: { marginTop: 8, fontSize: MOBILE_TYPE.body, color: t.metallicGrey ?? t.subText },
        headerTextCol: { flex: 1 },
        headerOrgName: { marginTop: 2, fontSize: MOBILE_TYPE.body, color: t.metallicGrey ?? t.subText, opacity: 0.9 },

        metricsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 18 },
        metricsRowCaption: {
          fontSize: MOBILE_TYPE.caption,
          color: t.placeholder,
          lineHeight: 16,
          marginTop: 10,
          textAlign: 'center',
        },
        crossSectionTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          marginTop: 4,
          marginBottom: 6,
          alignSelf: 'stretch',
        },
        crossSectionSub: {
          color: t.placeholder,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 17,
          marginBottom: 12,
          alignSelf: 'stretch',
        },
        crossSectionWrap: { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center', paddingHorizontal: 12 },
        reservationsMicro: {
          fontSize: MOBILE_TYPE.micro,
          color: t.placeholder,
          marginTop: 8,
          textAlign: 'center',
          lineHeight: 14,
        },
        planPillsHint: {
          fontSize: MOBILE_TYPE.micro,
          color: t.placeholder,
          marginTop: 8,
          textAlign: 'center',
          lineHeight: 14,
        },
        novedadesFooterHint: {
          fontSize: MOBILE_TYPE.micro,
          color: t.placeholder,
          marginTop: 10,
          lineHeight: 14,
        },
        quickSectionFooter: {
          fontSize: MOBILE_TYPE.micro,
          color: t.placeholder,
          marginTop: 12,
          lineHeight: 15,
          textAlign: 'center',
        },
        metricBox: {
          flex: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: MOBILE_RADII.chipMd,
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderWidth: 1,
          marginRight: 10,
          minHeight: isWebWide ? 130 : 0,
        },
        metricBoxLast: { marginRight: 0 },
        metricLabel: { color: t.metallicGrey ?? t.subText, fontSize: MOBILE_TYPE.caption },
        metricValue: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: 'bold' },
        metricHint: { marginTop: 6, color: t.placeholder, fontSize: MOBILE_TYPE.micro, lineHeight: 14 },
        metricPlanLink: {
          marginTop: 8,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          color: t.brand,
        },
        metricPlanCue: {
          marginTop: 10,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '800',
          color: t.brand,
        },
        metricLoadingWrap: { marginTop: 6 },

        sectionTitle: {
          color: t.subText,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: 'bold',
          marginBottom: 10,
        },

        planBox: {
          borderRadius: MOBILE_RADII.lg,
          paddingVertical: 18,
          paddingHorizontal: 16,
          borderWidth: 1.5,
          borderColor: t.brand,
          backgroundColor: t.boxBg,
          alignItems: 'center',
          marginBottom: 12,
          ...(t.buttonGlow ? { shadowColor: t.logoCian ?? t.brand, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 } : {}),
        },
        planTitle: { color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: '800' },
        planSubtitle: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 6, textAlign: 'center' },
        planDates: { marginTop: 10, color: t.placeholder, fontSize: MOBILE_TYPE.caption, textAlign: 'center' },

        activityNavOuter: {
          alignSelf: 'stretch',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          minHeight: 72,
        },
        activityNavBtn: {
          width: 44,
          height: MOBILE_SIZES.controlHeight,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: hexToRgba(t.brand, 0.06),
        },
        activityNavBtnDimmed: { opacity: 0.55 },
        planActivityStretch: { alignSelf: 'stretch' },
        planSwitchSpinner: { marginTop: 6 },
        activityNavCenter: {
          flex: 1,
          paddingHorizontal: 8,
          alignItems: 'center',
          justifyContent: 'center',
        },
        activityNavTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          textAlign: 'center',
        },
        activityNavHint: {
          marginTop: 4,
          color: t.placeholder,
          fontSize: MOBILE_TYPE.micro,
          textAlign: 'center',
        },
        activityAddLink: { marginTop: 8, alignSelf: 'center' },
        activityAddLinkText: { color: t.brand, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },

        pillRow: { flexDirection: 'row', marginTop: 12 },
        planPillBtn: {
          paddingHorizontal: 14,
          paddingVertical: 7,
          minHeight: MOBILE_SIZES.controlHeight,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          borderColor: hexToRgba(t.brand, 0.8),
          backgroundColor: hexToRgba(t.brand, 0.12),
          marginHorizontal: 6,
          minWidth: 118,
          alignItems: 'center',
          justifyContent: 'center',
          ...(t.buttonGlow || {}),
        },
        planPillText: { color: t.primaryText, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },

        novedadesCaja: {
          borderRadius: MOBILE_RADII.lg,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderWidth: 1.5,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          marginBottom: 12,
          overflow: 'hidden',
        },
        novedadesRail: {
          width: '100%',
          maxWidth: 720,
          alignSelf: 'stretch',
          marginTop: 12,
          marginBottom: 10,
        },
        novedadesCajaRail: {
          marginBottom: 0,
        },
        novedadesTitle: {
          color: t.brandText ?? t.brand,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '800',
          marginBottom: 6,
          letterSpacing: 0.8,
          textShadowColor: t.brandTextShadow ?? hexToRgba(t.brand, 0.8),
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 6,
        },
        novedadesTickerWrap: { minHeight: 24, justifyContent: 'center', overflow: 'hidden' },
        novedadesMarqueeRow: { flexDirection: 'row' },
        novedadesTickerText: {
          color: t.brandText ?? t.brand,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '700',
          letterSpacing: 0.5,
          textShadowColor: t.brandTextShadow ?? hexToRgba(t.brand, 0.7),
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
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          marginTop: 8,
          textAlign: 'right',
          textShadowColor: t.brandTextShadow ?? hexToRgba(t.brand, 0.5),
          textShadowRadius: 2,
        },
        chatBadge: {
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 18,
          height: 18,
          borderRadius: MOBILE_RADII.sm,
          backgroundColor: hexToRgba(t.brand, 0.9),
          borderWidth: 1,
          borderColor: t.boxBg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 5,
        },
        chatBadgeText: { color: t.buttonPrimaryText?.color || colors.dark.textPrimary, fontSize: MOBILE_TYPE.caption, fontWeight: '800' },
        reservationList: { marginTop: 8, alignSelf: 'stretch', width: '100%' },
        reservationRowTouchable: {
          alignSelf: 'stretch',
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: hexToRgba(t.brand, 0.08),
          borderRadius: MOBILE_RADII.md,
          paddingVertical: 8,
          paddingHorizontal: 10,
          marginBottom: 6,
        },
        reservationChipText: { color: t.text, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },

        quickRow: {
          flexDirection: isWeb && !isWebWide ? 'column' : 'row',
          justifyContent: 'flex-start',
          marginTop: 8,
          alignItems: 'stretch',
          gap: isWeb && !isWebWide ? 8 : 10,
        },
        quickBtn: {
          flex: isWebWide ? 1 : undefined,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          paddingVertical: isWeb && !isWebWide ? 12 : 16,
          paddingHorizontal: 12,
          minHeight: isWebWide ? 130 : undefined,
          alignItems: 'center',
          justifyContent: 'center',
        },
        quickBtnLast: {},
        quickBtnStacked: { marginRight: 0, marginBottom: 0 },
        quickBtnLastStacked: { marginBottom: 0 },
        quickIconWrap: {
          width: 36,
          height: 36,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          borderColor: hexToRgba(t.brand, 0.6),
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          overflow: 'visible',
        },
        quickLabel: { color: t.text, fontWeight: '600', fontSize: MOBILE_TYPE.body, textAlign: 'center' },
        quickHint: { color: t.placeholder, fontSize: MOBILE_TYPE.caption, marginTop: 4, textAlign: 'center' },

        secondaryBtn: {
          marginTop: 14,
          minHeight: MOBILE_SIZES.controlHeight,
          paddingVertical: 10,
          borderRadius: MOBILE_RADII.md,
          alignItems: 'center',
          justifyContent: 'center',
          ...t.buttonPrimary,
          ...(t.buttonGlow || {}),
        },
        secondaryBtnLogout: { marginTop: 18 },
        secondaryBtnText: { ...t.buttonPrimaryText, fontWeight: '600', fontSize: MOBILE_TYPE.body },

        freeClassCard: {
          marginTop: 14,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          padding: 14,
        },
        freeClassTitle: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800' },
        freeClassMeta: { color: t.subText ?? t.placeholder, fontSize: MOBILE_TYPE.body, marginTop: 6, lineHeight: 18 },
        freeClassPolicyLine: { color: t.subText ?? t.placeholder, fontSize: MOBILE_TYPE.body, marginTop: 8, lineHeight: 18 },
        freeClassActions: { flexDirection: 'row', marginTop: 12, gap: 10 },
        freeClassAction: {
          flex: 1,
          minHeight: MOBILE_SIZES.controlHeight,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hexToRgba(t.brand, 0.08),
        },
        freeClassActionPrimary: {
          ...t.buttonPrimary,
          borderColor: colors.transparent,
        },
        freeClassActionText: { color: t.text, fontWeight: '700', fontSize: MOBILE_TYPE.body },
        freeClassActionTextPrimary: { ...t.buttonPrimaryText, fontWeight: '800', fontSize: MOBILE_TYPE.body },

        footerInfo: { marginTop: 4, fontSize: MOBILE_TYPE.caption, color: t.placeholder, textAlign: 'center' },

        nudgeWrap: {
          marginBottom: 14,
          padding: 12,
          borderRadius: MOBILE_RADII.chipMd,
          borderWidth: 1,
          borderColor: t.brand,
          backgroundColor: hexToRgba(t.brand, 0.12),
        },
        nudgeTitle: { color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '900' },
        nudgeBody: { color: t.text, fontSize: MOBILE_TYPE.body, marginTop: 6, lineHeight: 18 },
        nudgeDismiss: { marginTop: 10, alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12 },
        nudgeDismissText: { color: t.brand, fontWeight: '800', fontSize: MOBILE_TYPE.body },
      }),
    [t, contentMaxWidth, isWebWide]
  );

  const freeClassPanel = useMemo(() => {
    const g = freeClassGrant;
    if (!g?.fechaYmd || !g.slotLabel) return null;
    if (isUserAbonoActive(abonoRow)) return null;
    if (
      g.organizationId &&
      orgForEntitlement &&
      String(g.organizationId) !== String(orgForEntitlement)
    ) {
      return null;
    }
    try {
      const d = new Date(`${g.fechaYmd}T12:00:00`);
      const loc = locale === 'en' ? 'en-US' : 'es-AR';
      const dateStr = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
      return { dateStr, timeStr: g.slotLabel };
    } catch {
      return { dateStr: g.fechaYmd, timeStr: g.slotLabel };
    }
  }, [freeClassGrant, abonoRow, orgForEntitlement, locale]);

  const planActivoDescripcion =
    effectivePlanKey === 'all_access'
      ? tStr('client_plan_all_access_desc')
      : effectivePlanKey
        ? tStr('client_plan_reserve_desc')
        : tStr('client_plan_choose_desc');

  const hasMultipleActivities = contractedKeys.length > 1;
  const reservationLabel = useCallback(
    (item) => {
      const d = new Date(`${item.date}T12:00:00`);
      const day = Number.isNaN(d.getTime())
        ? item.date
        : d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
      const p = PLAN_LABELS[item.planKey] || String(item.planKey || '').toUpperCase();
      return `${p} · ${day} · ${item.slot}`;
    },
    [locale],
  );

  const reservationItemsWithLabel = useMemo(
    () =>
      (Array.isArray(myReservations) ? myReservations : []).map((item) => ({
        ...item,
        label: reservationLabel(item),
      })),
    [myReservations, reservationLabel],
  );

  const dismissHomeNudge = useCallback(async () => {
    if (!homeNudge?.id) return;
    try {
      await supabase.rpc('mark_in_app_nudge_read', { p_nudge_id: homeNudge.id });
    } catch {
      void 0;
    }
    setHomeNudge(null);
  }, [homeNudge?.id]);

  const novedadesBox = (
    <TouchableOpacity
      style={[styles.novedadesCaja, styles.novedadesCajaRail]}
      onPress={goNovedades}
      onPressIn={() => { novedadesTickerPausedRef.current = true; }}
      onPressOut={() => { novedadesTickerPausedRef.current = false; }}
      activeOpacity={0.9}
    >
      <Text style={styles.novedadesTitle}>{tStr('client_novedades')}</Text>
      {novedadesLoading && tickerItems.length <= 1 ? (
        <View style={styles.novedadesTickerWrap}>
          <ActivityIndicator size="small" color={t.brand} />
        </View>
      ) : tickerItems.length === 0 ? (
        <Text style={styles.novedadesTickerText}>{tStr('client_sin_novedades')}</Text>
      ) : (
        <>
          <View style={styles.novedadesTickerWrap}>
            <Animated.View
              style={[
                styles.novedadesMarqueeRow,
                {
                  transform: [
                    {
                      translateX: novedadesMarqueeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -180],
                      }),
                    },
                  ],
                },
              ]}
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
          {tickerItems.length > 1 && (
            <View style={styles.novedadesDots}>
              {tickerItems.map((_, i) => (
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
      <Text style={styles.novedadesFooterHint}>{tStr('client_novedades_footer_hint')}</Text>
    </TouchableOpacity>
  );

  const novedadesSection = <View style={styles.novedadesRail}>{novedadesBox}</View>;

  const homeMainBody = (
    <>
        {homeNudge?.body ? (
          <View style={styles.nudgeWrap}>
            <Text style={styles.nudgeTitle}>{tStr('client_nudge_title')}</Text>
            <Text style={styles.nudgeBody}>{homeNudge.body}</Text>
            <TouchableOpacity style={styles.nudgeDismiss} onPress={dismissHomeNudge} activeOpacity={0.85}>
              <Text style={styles.nudgeDismissText}>{tStr('client_nudge_dismiss')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <NeoPanel style={styles.panel}>
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

            <View style={styles.headerTextCol}>
              <Text style={styles.headerGreeting}>{saludo}</Text>
              <Text style={styles.headerName}>{nombre}</Text>
              <Text style={styles.headerSub}>{tStr('client_welcome_panel')}</Text>
              {organization?.name ? (
                <Text style={styles.headerOrgName}>{organization.name}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.metricsRow}>
            <TouchableOpacity
              style={styles.metricBox}
              onPress={goPlanHub}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${tStr('client_plan')}: ${planLabel}. ${tStr('client_metric_plan_hint_a11y')}`}
            >
              <Text style={styles.metricLabel}>{tStr('client_plan')}</Text>
              {planLoading ? (
                <View style={styles.metricLoadingWrap}>
                  <ActivityIndicator color={t.brand} />
                </View>
              ) : (
                <Text style={styles.metricValue}>{planLabel}</Text>
              )}
              <Text style={styles.metricHint}>{planHintLine}</Text>
              <Text style={styles.metricPlanCue}>{tStr('client_metric_plan_open_programs')}</Text>
            </TouchableOpacity>

            <View style={[styles.metricBox, styles.metricBoxLast]}>
              <Text style={styles.metricLabel}>{tStr('client_my_reservations')}</Text>
              <Text style={styles.metricValue}>
                {myReservations.length > 0
                  ? tStr('client_my_reservations_count').replace('{{n}}', String(myReservations.length))
                  : tStr('client_my_reservations_empty_short')}
              </Text>
              {myReservations.length > 0 ? (
                <View style={styles.reservationList}>
                  {reservationItemsWithLabel.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.reservationRowTouchable}
                      activeOpacity={0.85}
                      onPress={() => goCalendario(r)}
                    >
                      <Text style={styles.reservationChipText} numberOfLines={2}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.metricHint}>{tStr('client_my_reservations_empty_hint')}</Text>
              )}
              <Text style={styles.reservationsMicro}>{tStr('client_metric_reservations_caption')}</Text>
            </View>
          </View>
          <Text style={styles.metricsRowCaption}>{tStr('client_metrics_row_caption')}</Text>
        </NeoPanel>

        <View style={styles.crossSectionWrap}>
          <Text style={styles.crossSectionTitle}>{tStr('client_home_main_section_title')}</Text>
          <Text style={styles.crossSectionSub}>{tStr('client_home_main_section_sub')}</Text>
        </View>

        <View style={styles.mainGrid}>
          <View style={styles.mainColPrimary}>
            <NeoPanel style={[styles.panel, isWebWide ? styles.panelEqualHeight : null]}>
              <Text style={styles.sectionTitle}>{tStr('client_plan_activo')}</Text>

              <View style={styles.planBox}>
                {hasMultipleActivities ? (
                  <View style={styles.planActivityStretch}>
                    <View style={styles.activityNavOuter}>
                      <TouchableOpacity
                        style={[styles.activityNavBtn, planSwitching && styles.activityNavBtnDimmed]}
                        onPress={() => cycleActivity(-1)}
                        disabled={planSwitching}
                        accessibilityRole="button"
                        accessibilityLabel={tStr('client_activity_prev')}
                      >
                        <Ionicons name="chevron-back" size={26} color={t.brand} />
                      </TouchableOpacity>
                      <View style={styles.activityNavCenter}>
                        <Text style={styles.activityNavTitle} numberOfLines={2}>
                          {planLabel}
                        </Text>
                        <Text style={styles.activityNavHint}>{tStr('client_activity_switch_hint')}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.activityNavBtn, planSwitching && styles.activityNavBtnDimmed]}
                        onPress={() => cycleActivity(1)}
                        disabled={planSwitching}
                        accessibilityRole="button"
                        accessibilityLabel={tStr('client_activity_next')}
                      >
                        <Ionicons name="chevron-forward" size={26} color={t.brand} />
                      </TouchableOpacity>
                    </View>
                    {planSwitching ? (
                      <ActivityIndicator style={styles.planSwitchSpinner} color={t.brand} size="small" />
                    ) : null}
                    <TouchableOpacity style={styles.activityAddLink} onPress={goPlanSelector} activeOpacity={0.85}>
                      <Text style={styles.activityAddLinkText}>{tStr('client_otra_actividad')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.planTitle}>{planLabel}</Text>
                )}
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
                  <TouchableOpacity
                    testID="client-home-cta-calendario"
                    style={styles.planPillBtn}
                    activeOpacity={0.9}
                    onPress={goCalendario}
                  >
                    <Text style={styles.planPillText}>{tStr('client_calendario')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="client-home-cta-trabajo-hoy"
                    style={styles.planPillBtn}
                    activeOpacity={0.9}
                    onPress={goTrabajoHoy}
                  >
                    <Text style={styles.planPillText}>{tStr('client_trabajo_hoy')}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.planPillsHint}>{tStr('client_plan_pills_hint')}</Text>

                {freeClassPanel ? (
                  <View style={styles.freeClassCard}>
                    <Text style={styles.freeClassTitle}>{tStr('client_freeclass_card_title')}</Text>
                    <Text style={styles.freeClassMeta}>
                      {tStr('client_freeclass_card_body')
                        .replace('{{date}}', freeClassPanel.dateStr)
                        .replace('{{time}}', freeClassPanel.timeStr || '')}
                    </Text>
                    <Text style={styles.freeClassPolicyLine}>
                      {tStr('client_freeclass_card_policy').replace(
                        '{{hours}}',
                        String(FREE_CLASS_CANCEL_NOTICE_HOURS),
                      )}
                    </Text>
                    <View style={styles.freeClassActions}>
                      <TouchableOpacity style={styles.freeClassAction} onPress={handleCancelFreeClass} activeOpacity={0.9}>
                        <Text style={styles.freeClassActionText}>{tStr('client_freeclass_card_cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.freeClassAction, styles.freeClassActionPrimary]}
                        onPress={goManageFreeClass}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.freeClassActionTextPrimary}>{tStr('client_freeclass_card_change')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>

              <Text style={styles.footerInfo}>{tStr('client_reservas_hint')}</Text>
            </NeoPanel>

          </View>

          <View style={styles.mainColSecondary}>
            <NeoPanel style={[styles.panel, isWebWide ? styles.panelEqualHeight : null]}>
              <Text style={styles.sectionTitle}>{tStr('client_quick_access')}</Text>

              <View style={styles.quickRow}>
                <TouchableOpacity
                  testID="client-home-cta-perfil"
                  style={[
                    styles.quickBtn,
                    isWeb && !isWebWide && styles.quickBtnStacked,
                  ]}
                  onPress={goPerfil}
                  activeOpacity={0.9}
                >
                  <View style={styles.quickIconWrap}>
                    <Ionicons name="person-circle-outline" size={22} color={t.brand} />
                  </View>
                  <Text style={styles.quickLabel}>{tStr('client_my_profile')}</Text>
                  <Text style={styles.quickHint}>{tStr('client_my_profile_hint')}</Text>
                </TouchableOpacity>

                {!isWebWide ? (
                  <TouchableOpacity
                    testID="client-home-cta-directory"
                    style={[
                      styles.quickBtn,
                      isWeb && !isWebWide && styles.quickBtnStacked,
                    ]}
                    onPress={goDirectory}
                    activeOpacity={0.9}
                  >
                    <View style={styles.quickIconWrap}>
                      <Ionicons name="compass-outline" size={22} color={t.brand} />
                    </View>
                    <Text style={styles.quickLabel}>{tStr('client_directory_tab')}</Text>
                    <Text style={styles.quickHint}>{tStr('client_directory_quick_hint')}</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.quickBtn,
                    styles.quickBtnLast,
                    isWeb && !isWebWide && styles.quickBtnStacked,
                    isWeb && !isWebWide && styles.quickBtnLastStacked,
                  ]}
                  onPress={goChat}
                  activeOpacity={0.9}
                >
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
              <Text style={styles.quickSectionFooter}>{tStr('client_quick_access_section_footer')}</Text>

              <TouchableOpacity style={[styles.secondaryBtn, styles.secondaryBtnLogout]} onPress={handleLogout}>
                <Text style={styles.secondaryBtnText}>{tStr('client_logout')}</Text>
              </TouchableOpacity>
            </NeoPanel>

          </View>
        </View>
    </>
  );

  return (
    <ScreenShell
      screen="ClientScreen"
      plan={planObj || undefined}
      scroll
      scrollProps={{
        testID: 'client-home-root',
        contentContainerStyle: styles.scroll,
        showsVerticalScrollIndicator: false,
      }}
    >
      {homeMainBody}
      {!isWebWide ? novedadesSection : null}
    </ScreenShell>
  );
}