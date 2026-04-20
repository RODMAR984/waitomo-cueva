// screens/PlanSelectorScreen.js — Planes por org + marca (logo, fondo org, saludo opcional)
// Waitomo Dark Only | Fase 3: planes desde Supabase por organization_id; fallback a lista fija

import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { resolveOrgLogoUri } from '../utils/resolveOrgLogoUri';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

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

const MAX_CARDS = 12;
const animatedValues = (() => {
  const arr = [];
  for (let i = 0; i < MAX_CARDS; i++) arr.push(new Animated.Value(1));
  return arr;
})();

export default function PlanSelectorScreen({ navigation, route }) {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const insets = useSafeAreaInsets();
  const { profile, organization, session, initialProfileSyncDone } = useAuth() || {};
  const [plansFromApi, setPlansFromApi] = useState([]);
  const [loading, setLoading] = useState(true);

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
        const { data, error } = await supabase
          .from('plans')
          .select('id, code, title, subtitle, active, order')
          .eq('organization_id', effectiveOrgId)
          .eq('active', true)
          .order('order', { ascending: true });
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

  useEffect(() => {
    displayPlans.forEach((plan, index) => {
      if (index < animatedValues.length && plan.active) startPulseAnimation(index);
    });
    return () => {
      animatedValues.forEach((value) => value.stopAnimation?.());
    };
  }, [displayPlans.length]);

  const startPulseAnimation = (index) => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValues[index], {
          toValue: 1.04,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValues[index], {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
        },
        scroll: {
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 80,
        },
        topBrandRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
          minHeight: 44,
        },
        logoSmall: { width: 120, height: 40, marginRight: 0 },
        orgNameCompact: {
          fontSize: 15,
          fontWeight: '800',
          textAlign: 'center',
          maxWidth: '90%',
        },
        welcomeLine: {
          color: t.text,
          textAlign: 'center',
          fontWeight: '800',
          fontSize: 20,
          marginBottom: 8,
          paddingHorizontal: 8,
        },
        orgMessage: {
          color: t.subText,
          fontSize: 14,
          lineHeight: 20,
          textAlign: 'center',
          marginBottom: 16,
          paddingHorizontal: 8,
          maxWidth: 420,
          alignSelf: 'center',
        },
        sectionLabel: {
          color: t.subText,
          textAlign: 'center',
          fontWeight: '700',
          fontSize: 13,
          letterSpacing: 0.8,
          marginBottom: 14,
          textTransform: 'uppercase',
        },
        header: {
          color: t.subText,
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: 18,
          marginBottom: 20,
        },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        cardWrapper: {
          flex: 1,
        },
        card: {
          alignItems: 'center',
          justifyContent: 'center',
          height: 120,
          margin: 8,
          padding: 20,
          borderRadius: 18,
          borderWidth: 2.5,
          backgroundColor: t.boxBg,
          borderColor: t.borderStrong,
          shadowColor: t.borderStrong,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.6,
          shadowRadius: 16,
          elevation: 10,
        },
        cardDisabled: {
          opacity: 0.4,
          borderStyle: 'dashed',
        },
        title: {
          color: t.brand,
          fontSize: 16,
          fontWeight: '800',
          textAlign: 'center',
          marginTop: 4,
          textShadowColor: hexToRgba(t.brand, 0.6),
          textShadowRadius: 12,
        },
        subtitle: {
          color: t.subText,
          fontSize: 12,
          marginTop: 6,
          textAlign: 'center',
        },
        emptyWrap: {
          paddingVertical: 32,
          paddingHorizontal: 20,
          alignItems: 'center',
        },
        emptyTitle: {
          color: t.text,
          fontSize: 16,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 10,
        },
        emptyHint: {
          color: t.subText,
          fontSize: 14,
          textAlign: 'center',
          lineHeight: 20,
        },
        skipLink: {
          marginTop: 20,
          alignItems: 'center',
          paddingVertical: 10,
        },
        skipLinkText: {
          color: t.brand,
          fontSize: 14,
          fontWeight: '600',
        },
        homeAbonoCard: {
          marginBottom: 18,
          padding: 16,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        homeAbonoKicker: {
          color: t.subText,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        },
        homeAbonoPlan: {
          color: t.text,
          fontSize: 18,
          fontWeight: '800',
          marginTop: 8,
        },
        homeAbonoHint: {
          color: t.subText,
          fontSize: 12,
          lineHeight: 17,
          marginTop: 8,
        },
        homeAbonoRow: {
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        homeAbonoCta: {
          color: t.brand,
          fontSize: 13,
          fontWeight: '800',
        },
      }),
    [t],
  );

  const goToPlan = (plan) => {
    navigation.navigate('PlanDetail', { plan });
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
    const animatedStyle = {
      transform: [{ scale: index < animatedValues.length ? animatedValues[index] : animatedValues[0] }],
    };
    const key = `${plan.id}_${index}`;
    const disabled = !plan.active;
    const titleKey = `plan_${plan.id}_title`;
    const planWithTitle = {
      ...plan,
      title: plan.title != null ? plan.title : tStr(titleKey),
    };
    const line2 = resolveSubtitleLine(plan);

    return (
      <View key={key} style={styles.cardWrapper}>
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => goToPlan(planWithTitle)}
            disabled={disabled}
            style={[styles.card, disabled && styles.cardDisabled]}
          >
            <Text style={styles.title}>{planWithTitle.title}</Text>
            {line2 ? <Text style={styles.subtitle}>{line2}</Text> : null}
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const planPairs = [];
  for (let i = 0; i < displayPlans.length; i += 2) {
    planPairs.push(displayPlans.slice(i, i + 2));
  }

  const hasPlanStored = !!(profile?.plan_actual && String(profile.plan_actual).trim());
  const showSkipToPanel = !!session?.user?.id && !hasPlanStored;

  return (
    <BackgroundWrapper screen={backdropScreen}>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12) + 8 }]}
        >
          {waitingOrgForAuthedUser ? (
            <View style={{ minHeight: 420, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
              <ActivityIndicator size="large" color={t.brand} />
              <Text style={{ color: t.subText, marginTop: 14, fontSize: 14, textAlign: 'center' }}>
                {tStr('common_loading')}
              </Text>
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
            <Text style={[styles.header, { marginTop: 8 }]}>{tStr('plan_selector_header')}</Text>
          ) : null}

          {!waitingOrgForAuthedUser && clientHome && sessionUserId ? (
            <TouchableOpacity
              style={styles.homeAbonoCard}
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

          {!waitingOrgForAuthedUser && !loading && displayPlans.length > 0
            ? planPairs.map((pair, rowIndex) => (
                <View key={`row_${rowIndex}`} style={styles.row}>
                  {pair.map((p, idx) => renderPlanCard(p, rowIndex * 2 + idx))}
                </View>
              ))
            : null}

          {!waitingOrgForAuthedUser && showSkipToPanel ? (
            <TouchableOpacity
              style={styles.skipLink}
              onPress={() => navigation.replace('ClientTabs')}
              activeOpacity={0.85}
            >
              <Text style={styles.skipLinkText}>{tStr('welcome_org_skip_to_panel')}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    </BackgroundWrapper>
  );
}
