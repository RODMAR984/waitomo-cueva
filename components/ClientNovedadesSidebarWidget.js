// Widget de novedades en la barra lateral web (ClientTabs), mismo criterio que ClientScreen.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { supabase } from '../supabaseClient';
import { normalizePlanKey } from '../utils/planKeyNormalize';
import { resolveFreeClassGrant } from '../services/booking/trialClassGrant';
import { evaluateClientCommunityAccess, isUserAbonoActive, abonoCoversUserPlan } from '../utils/clientWorkoutEntitlement';
import { trackEvent, reportError } from '../utils/observability';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';
import NeoPanel from './NeoPanel';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
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

const PLAN_ACTIVITY_ORDER = Object.keys(PLAN_LABELS);

export default function ClientNovedadesSidebarWidget() {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const {
    profile,
    user,
    activePlanId,
    organization,
    userPlans,
  } = useAuth() || {};

  const aptoMedico = !!(profile?.apto_medico_url || profile?.aptoMedico);

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
            void 0;
          }
        }
      }
      return false;
    },
    [navigation],
  );

  const [planKey, setPlanKey] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [userAbonosActive, setUserAbonosActive] = useState([]);
  const [abonoLoading, setAbonoLoading] = useState(true);
  const [freeClassGrant, setFreeClassGrant] = useState(null);

  useEffect(() => {
    let alive = true;
    const fromCtx = normalizePlanKey(activePlanId);
    if (fromCtx) {
      setPlanKey(fromCtx);
      setPlanLoading(false);
      return () => { alive = false; };
    }
    const fromProfile = normalizePlanKey(profile?.plan_actual || profile?.planActual);
    if (fromProfile) {
      setPlanKey(fromProfile);
      setPlanLoading(false);
      return () => { alive = false; };
    }
    setPlanKey(null);
    setPlanLoading(false);
    return () => { alive = false; };
  }, [activePlanId, profile?.plan_actual, profile?.planActual]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) {
        if (alive) {
          setUserAbonosActive([]);
          setAbonoLoading(false);
        }
        return;
      }
      setAbonoLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_abonos')
          .select('id, plan_id, status, start_date, end_date, sessions_total, sessions_used, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25);
        if (!alive) return;
        if (error) throw error;
        const list = Array.isArray(data)
          ? data.filter((r) => {
              const s = String(r?.status || '').toLowerCase();
              return s === 'active' || s === 'pending';
            })
          : [];
        setUserAbonosActive(list);
      } catch {
        if (alive) setUserAbonosActive([]);
      } finally {
        if (alive) setAbonoLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

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

  const orgForEntitlement = organization?.id || profile?.organization_id || null;

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

  const [novedades, setNovedades] = useState([]);
  const [novedadesLoading, setNovedadesLoading] = useState(true);
  const [novedadesTickerIndex, setNovedadesTickerIndex] = useState(0);
  const novedadesTickerPausedRef = useRef(false);
  const novedadesMarqueeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
          surface: 'sidebar',
        });
      } catch (e) {
        reportError('client_news_load_failed', e, { surface: 'sidebar' });
        if (alive) setNovedades([]);
      } finally {
        if (alive) setNovedadesLoading(false);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timeoutId);
    };
  }, [organization?.id, profile?.organization_id, abonoLoading, communityAccess.ok]);

  const calcDaysUntil = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    return Math.ceil((d.getTime() - now.getTime()) / 86400000);
  };

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
    if (tickerItems.length <= 1) return;
    const id = setInterval(() => {
      if (novedadesTickerPausedRef.current) return;
      setNovedadesTickerIndex((i) => (i + 1) % tickerItems.length);
    }, 3500);
    return () => clearInterval(id);
  }, [tickerItems.length]);

  useEffect(() => {
    setNovedadesTickerIndex((prev) => (prev >= tickerItems.length ? 0 : prev));
  }, [tickerItems.length]);

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
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [currentNovedadTitle, novedadesTickerIndex, novedadesMarqueeAnim]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flex: 1,
          minHeight: 0,
          borderTopWidth: 1,
          borderTopColor: t.overlayBorder,
          paddingTop: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.sm,
          paddingBottom: Platform.OS === 'web' ? MOBILE_SPACING.sm + 2 : MOBILE_SPACING.sm,
        },
        cajaNeo: {
          flex: 1,
          minHeight: 0,
          borderRadius: MOBILE_RADII.md,
          backgroundColor: t.boxBg,
          width: '100%',
        },
        cajaInner: {
          flex: 1,
          minHeight: 0,
          paddingVertical: MOBILE_SPACING.md - 2,
          paddingHorizontal: MOBILE_SPACING.sm,
        },
        title: {
          color: t.brandText ?? t.brand,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '800',
          marginBottom: MOBILE_SPACING.sm / 2,
          letterSpacing: 0.5,
        },
        tickerWrap: {
          minHeight: MOBILE_SPACING.xl,
          maxHeight: 56,
          justifyContent: 'center',
          overflow: 'hidden',
        },
        marqueeRow: { flexDirection: 'row' },
        tickerText: {
          color: t.brandText ?? t.brand,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          maxWidth: '100%',
        },
        dots: { flexDirection: 'row', justifyContent: 'center', marginTop: MOBILE_SPACING.xs, gap: MOBILE_SPACING.sm / 2 },
        dot: {
          width: MOBILE_SPACING.xs,
          height: MOBILE_SPACING.xs,
          borderRadius: MOBILE_SPACING.xs / 2,
          backgroundColor: hexToRgba(t.text, 0.3),
        },
        dotActive: { backgroundColor: t.brandText ?? t.brand },
        verTodas: {
          color: t.brandText ?? t.brand,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          marginTop: MOBILE_SPACING.xs,
          textAlign: 'right',
        },
        hint: {
          fontSize: MOBILE_TYPE.caption,
          color: t.placeholder,
          marginTop: MOBILE_SPACING.xs,
          lineHeight: MOBILE_SPACING.lg,
        },
      }),
    [t],
  );

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.wrap}>
      <NeoPanel spark style={styles.cajaNeo}>
        <TouchableOpacity
          style={styles.cajaInner}
          onPress={goNovedades}
          onPressIn={() => { novedadesTickerPausedRef.current = true; }}
          onPressOut={() => { novedadesTickerPausedRef.current = false; }}
          activeOpacity={0.9}
        >
          <Text style={styles.title}>{tStr('client_novedades')}</Text>
          {novedadesLoading && tickerItems.length <= 1 ? (
            <View style={styles.tickerWrap}>
              <ActivityIndicator size="small" color={t.brand} />
            </View>
          ) : tickerItems.length === 0 ? (
            <Text style={styles.tickerText}>{tStr('client_sin_novedades')}</Text>
          ) : (
            <>
              <View style={styles.tickerWrap}>
                <Animated.View
                  style={[
                    styles.marqueeRow,
                    {
                      transform: [
                        {
                          translateX: novedadesMarqueeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -120],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.tickerText} numberOfLines={2}>
                    {currentNovedadTitle}
                    {'  ·  '}
                  </Text>
                  <Text style={styles.tickerText} numberOfLines={2}>
                    {currentNovedadTitle}
                  </Text>
                </Animated.View>
              </View>
              {tickerItems.length > 1 && (
                <View style={styles.dots}>
                  {tickerItems.map((_, i) => (
                    <View key={i} style={[styles.dot, i === novedadesTickerIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
            </>
          )}
          <Text style={styles.verTodas}>{tStr('client_ver_todas')} ›</Text>
          <Text style={styles.hint}>{tStr('client_novedades_footer_hint')}</Text>
        </TouchableOpacity>
      </NeoPanel>
    </View>
  );
}
