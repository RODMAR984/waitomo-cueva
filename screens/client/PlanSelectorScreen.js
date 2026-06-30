// screens/PlanSelectorScreen.js — Planes por org + marca (logo, fondo org, saludo opcional)
// Waitomo Dark Only | Fase 3: planes desde Supabase por organization_id; fallback a lista fija

import React, { useMemo, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import NeoPanel from '../../components/NeoPanel';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePlanContext } from '../../contexts/PlanContext';
import { supabase } from '../../supabaseClient';
import { resolveOrgLogoUri } from '../../utils/resolveOrgLogoUri';
import { IMAGENES_POR_PLAN } from '../../utils/imagenesFijas';
import { WEB_CONTENT_MAX_WIDTH, WEB_DESKTOP_BREAKPOINT } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

const FALLBACK_PLAN_IDS = [
  { id: 'cross', active: true },
  { id: 'oly', active: true },
  { id: 'openbox', active: true },
  { id: 'stretching', active: true },
  { id: 'evolucion', active: true },
  { id: 'yoga', active: true },
  { id: 'hyrox', active: true },
  { id: 'all_access', active: true },
  { id: 'pase_total', active: true },
];

/** Evita spinner eterno si la query a `plans` no resuelve (red / RLS / tablas). */
const PLANS_QUERY_TIMEOUT_MS = 14000;

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full =
    clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function PlanSelectorScreen({ navigation, route }) {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { setPlan: setPlanSafe } = usePlanContext() || {};
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWebDesktop = width >= WEB_DESKTOP_BREAKPOINT;
  const isTablet = width >= 760 && width < WEB_DESKTOP_BREAKPOINT;
  const { profile, organization, session, initialProfileSyncDone } = useAuth() || {};
  const [plansFromApi, setPlansFromApi] = useState([]);
  const [loading, setLoading] = useState(true);
  const pulseValuesRef = useRef([]);

  /** Perfil y objeto org pueden desfasarse un frame tras invitación / refresh: unificar para no mostrar grilla Waitomo legacy. */
  const effectiveOrgId = profile?.organization_id || organization?.id || null;
  const logoUri = useMemo(() => resolveOrgLogoUri(organization?.logo_url), [organization?.logo_url]);
  const orgName = organization?.name?.trim() || '';
  const clientWelcomeMessage = (organization?.features?.client_welcome_message || '').trim();
  const showOrgHeader = !!(effectiveOrgId && (orgName || logoUri));
  const sessionUserId = session?.user?.id;
  const clientHome = route?.params?.clientHomeContext || null;
  const waitingOrgForAuthedUser =
    !!sessionUserId && !effectiveOrgId && initialProfileSyncDone === false;

  /** Fondo Waitomo (jpg plan selector) solo si la org ya está hidratada; si no, neutro hasta evitar flash. */
  const orgHydratedForBackdrop =
    !effectiveOrgId ||
    !!(organization?.id && String(organization.id) === String(effectiveOrgId));
  const backdropScreen =
    waitingOrgForAuthedUser || (sessionUserId && effectiveOrgId && !orgHydratedForBackdrop)
      ? 'neutral'
      : 'PlanSelector';

  useEffect(() => {
    if (!effectiveOrgId) {
      setPlansFromApi([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const queryPromise = supabase
          .from('plans')
          .select('id, code, title, subtitle, card_highlights, active, order')
          .eq('organization_id', effectiveOrgId)
          .eq('active', true)
          .order('order', { ascending: true });

        const timeoutPromise = new Promise((resolve) =>
          setTimeout(
            () => resolve({ data: null, error: { message: 'plan_selector_query_timeout' }, __timedOut: true }),
            PLANS_QUERY_TIMEOUT_MS,
          ),
        );

        const result = await Promise.race([queryPromise, timeoutPromise]);
        const { data, error } = result || {};
        if (result?.__timedOut || error?.message === 'plan_selector_query_timeout') {
          console.log('PlanSelector: timeout cargando planes (>=' + PLANS_QUERY_TIMEOUT_MS + 'ms)', {
            organization_id: effectiveOrgId,
          });
          if (alive) setPlansFromApi([]);
          return;
        }
        if (error) throw error;
        if (alive) setPlansFromApi(Array.isArray(data) ? data : []);
      } catch (e) {
        console.log('PlanSelector: error cargando planes', e?.message || e);
        if (alive) setPlansFromApi([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [effectiveOrgId]);

  const displayPlans = useMemo(() => {
    if (plansFromApi.length > 0) {
      return plansFromApi.map((p) => ({
        id: p.code,
        code: p.code,
        title: p.title,
        subtitle: p.subtitle,
        card_highlights: p.card_highlights,
        active: p.active !== false,
      }));
    }
    if (effectiveOrgId) {
      return [];
    }
    // Grilla legacy solo para invitados sin sesión (flujo Waitomo / demo). Con sesión nunca: evita flash tras invitación.
    if (sessionUserId) {
      return [];
    }
    return FALLBACK_PLAN_IDS;
  }, [plansFromApi, effectiveOrgId, sessionUserId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
        },
        backBtn: {
          width: 'auto',
          maxWidth: 180,
          alignSelf: 'flex-start',
          marginBottom: MOBILE_SPACING.sm,
        },
        scroll: {
          flexGrow: 1,
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingTop: MOBILE_SPACING.md,
          paddingBottom: 80,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        topBrandRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: MOBILE_SPACING.md + 2,
          minHeight: 44,
        },
        logoSmall: { width: 120, height: 40, marginRight: 0 },
        orgNameCompact: {
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          textAlign: 'center',
          maxWidth: '90%',
        },
        welcomeLine: {
          color: t.text,
          textAlign: 'center',
          fontWeight: '800',
          fontSize: MOBILE_TYPE.title,
          marginBottom: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.sm,
        },
        orgMessage: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          lineHeight: 20,
          textAlign: 'center',
          marginBottom: MOBILE_SPACING.lg,
          paddingHorizontal: MOBILE_SPACING.sm,
          maxWidth: 420,
          alignSelf: 'center',
        },
        sectionLabel: {
          color: t.subText,
          textAlign: 'center',
          fontWeight: '700',
          fontSize: MOBILE_TYPE.caption,
          letterSpacing: 0.8,
          marginBottom: MOBILE_SPACING.md + 2,
          textTransform: 'uppercase',
        },
        header: {
          color: t.subText,
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: MOBILE_TYPE.bodyStrong,
          marginBottom: MOBILE_SPACING.xl,
        },
        loadingWrap: {
          minHeight: 420,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: MOBILE_SPACING.xxl,
        },
        loadingText: {
          color: t.subText,
          marginTop: MOBILE_SPACING.md + 2,
          fontSize: MOBILE_TYPE.body,
          textAlign: 'center',
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginHorizontal: -MOBILE_SPACING.sm,
        },
        cardWrapper: {
          width: isWebDesktop ? '33.333%' : isTablet ? '50%' : '100%',
          paddingHorizontal: MOBILE_SPACING.sm,
          marginBottom: MOBILE_SPACING.md,
        },
        cardInner: {
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          minHeight: isWebDesktop ? 168 : 148,
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: MOBILE_SPACING.md + 4,
          alignSelf: 'stretch',
        },
        cardDisabled: {
          opacity: 0.5,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: hexToRgba(t.logoCian || t.brand, 0.45),
          borderRadius: MOBILE_RADII.md,
        },
        title: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          textAlign: 'left',
          marginTop: 2,
          alignSelf: 'stretch',
        },
        planBullet: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 17,
          marginTop: 6,
          textAlign: 'left',
          alignSelf: 'stretch',
        },
        emptyWrap: {
          paddingVertical: MOBILE_SPACING.xxl + MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.xl,
          alignItems: 'center',
        },
        emptyTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: MOBILE_SPACING.sm + 2,
        },
        emptyHint: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          textAlign: 'center',
          lineHeight: 20,
        },
        skipLink: {
          marginTop: MOBILE_SPACING.xl,
          alignItems: 'center',
          paddingVertical: MOBILE_SPACING.sm + 2,
        },
        skipLinkText: {
          color: t.brand,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '600',
        },
        noOrgCta: {
          marginTop: MOBILE_SPACING.xl - 2,
          alignSelf: 'stretch',
          maxWidth: 320,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: MOBILE_SIZES.controlHeightLg,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.xl - 2,
          borderRadius: MOBILE_RADII.md,
          backgroundColor: t.brand,
        },
        noOrgCtaText: {
          color: '#fff',
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
        },
        homeAbonoWrap: {
          marginBottom: MOBILE_SPACING.xl - 2,
          borderRadius: MOBILE_RADII.lg,
          backgroundColor: t.boxBg,
        },
        homeAbonoInner: {
          padding: MOBILE_SPACING.lg,
        },
        homeAbonoKicker: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '800',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        },
        homeAbonoPlan: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          marginTop: MOBILE_SPACING.sm,
        },
        homeAbonoHint: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 17,
          marginTop: MOBILE_SPACING.sm,
        },
        homeAbonoRow: {
          marginTop: MOBILE_SPACING.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        homeAbonoCta: {
          color: t.brand,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '800',
        },
      }),
    [t, isWebDesktop, isTablet],
  );

  const parseCardHighlights = (text) => {
    const s = String(text ?? '').trim();
    if (!s) return null;
    const lines = s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    return lines.length ? lines.slice(0, 8) : null;
  };

  const planCardBullets = (plan, line2) => {
    const custom = parseCardHighlights(plan?.card_highlights);
    if (custom?.length) return custom;
    const raw = String(line2 || '').trim();
    if (raw) {
      const parts = raw.split(/\s*[|·]\s*/).map((x) => x.trim()).filter(Boolean);
      if (parts.length >= 2) return parts;
      if (parts.length === 1) return [parts[0], tStr('plan_selector_card_b2'), tStr('plan_selector_card_b3')];
    }
    return [tStr('plan_selector_card_b1'), tStr('plan_selector_card_b2'), tStr('plan_selector_card_b3')];
  };

  const goToPlan = (plan) => {
    const titleKey = `plan_${plan.id}_title`;
    const planWithTitle = {
      ...plan,
      title: plan.title != null ? plan.title : tStr(titleKey),
    };
    const pidKey = String(plan.id || '').toLowerCase().trim();
    const fallbackImg = IMAGENES_POR_PLAN[pidKey];
    const images = Array.isArray(plan.images) && plan.images.length
      ? plan.images
      : [plan.image ?? fallbackImg].filter((x) => x != null);
    const nombre = pidKey;
    if (typeof setPlanSafe === 'function') {
      setPlanSafe({ ...planWithTitle, images, nombre });
    }

    const pid = String(plan.id || '').toLowerCase().trim();
    const isEvolucionPlan =
      pid === 'evolucion' || /evoluci[oó]n/i.test(String(planWithTitle.title || ''));
    if (isEvolucionPlan) {
      navigation.navigate('RegistroEvolucion', { plan: planWithTitle });
      return;
    }
    if (pid === 'pase_total') {
      navigation.navigate('AbonosPases', {
        plan: {
          ...planWithTitle,
          id: 'pase_total',
          title: 'PASE TOTAL',
          nombre: 'Pase Total',
        },
        soloEvolucion: false,
      });
      return;
    }
    navigation.navigate('AbonosPases', { plan: planWithTitle, soloEvolucion: false });
  };

  const resolveSubtitleLine = (plan) => {
    const subtitleKey = `plan_${plan.id}_subtitle`;
    let line2 = '';
    if (plan.subtitle != null && String(plan.subtitle).trim() !== '') {
      line2 = String(plan.subtitle).trim();
    } else if (plan.subtitle === null || plan.subtitle === undefined) {
      const tr = tStr(subtitleKey);
      line2 = tr !== subtitleKey ? tr : '';
    }
    return line2;
  };

  const renderPlanCard = (plan, index) => {
    const key = `${plan.id}_${index}`;
    const disabled = !plan.active;
    const titleKey = `plan_${plan.id}_title`;
    const planWithTitle = {
      ...plan,
      title: plan.title != null ? plan.title : tStr(titleKey),
    };
    const line2 = resolveSubtitleLine(plan);
    const bullets = planCardBullets(plan, line2);

    return (
      <View key={key} style={styles.cardWrapper}>
        <Animated.View style={{ transform: [{ scale: pulseValuesRef.current[index] || 1 }] }}>
          <NeoPanel
            spark
            style={{
              borderRadius: MOBILE_RADII.lg,
              width: '100%',
              backgroundColor: t.boxBg,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => goToPlan(plan)}
              disabled={disabled}
              style={[styles.cardInner, disabled && styles.cardDisabled]}
            >
              <Text style={styles.title}>{planWithTitle.title}</Text>
              {bullets.map((b, i) => (
                <Text key={i} style={styles.planBullet}>
                  ✓ {b}
                </Text>
              ))}
            </TouchableOpacity>
          </NeoPanel>
        </Animated.View>
      </View>
    );
  };

  const hasPlanStored = !!(profile?.plan_actual && String(profile.plan_actual).trim());
  const showSkipToPanel = !!session?.user?.id && !hasPlanStored && !!effectiveOrgId;

  useEffect(() => {
    const values = displayPlans.map((_, i) => pulseValuesRef.current[i] || new Animated.Value(1));
    pulseValuesRef.current = values;
    const loops = values.map((v, i) => {
      if (displayPlans[i]?.active === false) return null;
      return Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1.025, duration: 900, useNativeDriver: true }),
          Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      );
    });
    loops.forEach((l) => l?.start());
    return () => loops.forEach((l) => l?.stop());
  }, [displayPlans]);

  return (
    <ScreenShell
      screen={backdropScreen}
      scroll
      scrollProps={{
        contentContainerStyle: [
          styles.scroll,
          { paddingTop: Math.max(insets.top, MOBILE_SPACING.md) + MOBILE_SPACING.sm },
        ],
      }}
      rootStyle={styles.root}
    >
          {!waitingOrgForAuthedUser ? (
            <BackNavButton
              onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.navigate('Home');
              }}
              label={tStr('common_back')}
              style={styles.backBtn}
            />
          ) : null}
          {waitingOrgForAuthedUser ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={t.brand} />
              <Text style={styles.loadingText}>{tStr('common_loading')}</Text>
            </View>
          ) : null}

          {!waitingOrgForAuthedUser && showOrgHeader ? (
            <>
              <View style={styles.topBrandRow}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoSmall} resizeMode="contain" />
                ) : (
                  <Text style={[styles.orgNameCompact, { color: t.brand }]} numberOfLines={2}>
                    {orgName}
                  </Text>
                )}
              </View>
              <Text style={styles.welcomeLine}>
                {tStr('plan_selector_welcome_prefix')} {orgName}
              </Text>
              {clientWelcomeMessage ? <Text style={styles.orgMessage}>{clientWelcomeMessage}</Text> : null}
            </>
          ) : null}

          {!waitingOrgForAuthedUser && !showOrgHeader ? (
            <Text style={[styles.header, { marginTop: MOBILE_SPACING.sm }]}>{tStr('plan_selector_header')}</Text>
          ) : null}

          {!waitingOrgForAuthedUser && clientHome && sessionUserId ? (
            <NeoPanel spark style={styles.homeAbonoWrap}>
              <TouchableOpacity
                style={styles.homeAbonoInner}
                activeOpacity={0.88}
                onPress={() => {
                  const h = clientHome;
                  try {
                    navigation.navigate('DetalleAbono', {
                      planKey: h.planKey,
                      subscription: h.abonoRow || null,
                      plan: h.planKey ? { id: h.planKey, title: h.planLabel } : null,
                    });
                  } catch {
                    try {
                      navigation.navigate('DetalleAbonoScreen', {
                        planKey: h.planKey,
                        subscription: h.abonoRow || null,
                        plan: h.planKey ? { id: h.planKey, title: h.planLabel } : null,
                      });
                    } catch {
                      // ignore
                    }
                  }
                }}
              >
                <Text style={styles.homeAbonoKicker}>{tStr('plan_selector_home_abono_title')}</Text>
                <Text style={styles.homeAbonoPlan} numberOfLines={2}>
                  {clientHome.planLabel || '—'}
                </Text>
                {!!clientHome.planHintLine && (
                  <Text style={styles.homeAbonoHint} numberOfLines={4}>
                    {clientHome.planHintLine}
                  </Text>
                )}
                <View style={styles.homeAbonoRow}>
                  <Text style={styles.homeAbonoCta}>{tStr('plan_selector_home_abono_cta')}</Text>
                  <Ionicons name="chevron-forward" size={20} color={t.brand} />
                </View>
              </TouchableOpacity>
            </NeoPanel>
          ) : null}

          {!waitingOrgForAuthedUser && showOrgHeader ? (
            <Text style={styles.sectionLabel}>{tStr('plan_selector_programs_section')}</Text>
          ) : null}

          {!waitingOrgForAuthedUser && loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={t.brand} />
            </View>
          ) : null}

          {!waitingOrgForAuthedUser && !loading && displayPlans.length === 0 && effectiveOrgId ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{tStr('plan_selector_empty_title')}</Text>
              <Text style={styles.emptyHint}>{tStr('plan_selector_empty_hint')}</Text>
            </View>
          ) : null}

          {!waitingOrgForAuthedUser &&
          !loading &&
          !!sessionUserId &&
          !effectiveOrgId &&
          displayPlans.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{tStr('plan_selector_no_org_title')}</Text>
              <Text style={styles.emptyHint}>{tStr('plan_selector_no_org_hint')}</Text>
              <TouchableOpacity
                style={styles.noOrgCta}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('WelcomeClientJoin')}
              >
                <Text style={styles.noOrgCtaText}>{tStr('plan_selector_no_org_cta')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!waitingOrgForAuthedUser && !loading && displayPlans.length > 0 ? (
            <View style={styles.grid}>{displayPlans.map((p, idx) => renderPlanCard(p, idx))}</View>
          ) : null}

          {!waitingOrgForAuthedUser && showSkipToPanel ? (
            <TouchableOpacity
              style={styles.skipLink}
              onPress={() => navigation.replace('ClientTabs')}
              activeOpacity={0.85}
            >
              <Text style={styles.skipLinkText}>{tStr('welcome_org_skip_to_panel')}</Text>
            </TouchableOpacity>
          ) : null}
    </ScreenShell>
  );
}
