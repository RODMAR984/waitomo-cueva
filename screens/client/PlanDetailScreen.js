// screens/PlanDetailScreen.js — Waitomo Dark Only (unificar brillo de paneles/overlays)
// - Solo colors.dark como base
// - Sin colores literales ni estilos inline
// - Overlays/bordes: ahora usan waitomo.overlayBg / waitomo.overlayBorder
// - Funcionalidad preservada: setPlan seguro, navegación a Registro/FreeClass/Abonos y Volver

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import { usePlanContext } from '../../contexts/PlanContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { IMAGENES_POR_PLAN } from '../../utils/imagenesFijas';
import { normalizePlanKey } from '../../utils/planKeyNormalize';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';

export default function PlanDetailScreen({ route, navigation }) {
  const plan = route?.params?.plan;
  const { height: winH } = useWindowDimensions();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { session, profile, updateProfile } = useAuth() || {};
  const planPersistedFor = useRef(null);

  // Intentamos usar el contexto de forma segura (sin romper si no hay provider)
  let setPlanSafe;
  try {
    const ctx = usePlanContext();
    setPlanSafe = ctx?.setPlan;
  } catch (e) {
    setPlanSafe = undefined;
  }

  useEffect(() => {
    if (!plan) return;
    const images = Array.isArray(plan.images) ? plan.images : [plan.image];
    const nombre = plan.id?.toLowerCase?.().trim?.();
    if (typeof setPlanSafe === 'function') {
      setPlanSafe({ ...plan, images, nombre });
    }
  }, [plan]); // preservamos comportamiento del original

  // Guardar plan elegido en profiles.plan_actual (antes solo existía en contexto → Supabase quedaba null y el chat fallaba por RLS)
  useEffect(() => {
    if (!plan?.id || !session?.user?.id || typeof updateProfile !== 'function') return;
    const canonical = normalizePlanKey(plan.id);
    if (!canonical) return;
    const cur = profile?.plan_actual ? normalizePlanKey(profile.plan_actual) : null;
    if (cur === canonical) return;
    const key = `${session.user.id}:${canonical}`;
    if (planPersistedFor.current === key) return;

    let cancelled = false;
    (async () => {
      const row = await updateProfile({ plan_actual: canonical });
      if (cancelled) return;
      if (row?.id) planPersistedFor.current = key;
    })();
    return () => {
      cancelled = true;
    };
  }, [plan?.id, session?.user?.id, profile?.plan_actual, updateProfile]);

  // Navegaciones: propagamos SIEMPRE el plan y el resto de params
  const handleVolver = () => navigation.goBack();
  const handleVerHorariosClaseGratis = () =>
    navigation.navigate('FreeClassRequest', { ...route?.params, plan });
  const handleVerAbonos = () => {
    const planId = (plan?.id || '').toLowerCase().trim();
    const isEvolucionPlan = planId === 'evolucion' || /evoluci[oó]n/i.test(String(plan?.title ?? plan?.nombre ?? ''));
    if (isEvolucionPlan) {
      navigation.navigate('RegistroEvolucion', { plan });
      return;
    }
    if (planId === 'pase_total') {
      navigation.navigate('AbonosPases', { plan: { ...plan, id: 'pase_total', title: 'PASE TOTAL', nombre: 'Pase Total' }, soloEvolucion: false });
      return;
    }
    navigation.navigate('AbonosPases', { plan, soloEvolucion: false });
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        buttonOutline: {
          alignItems: 'center',
          backgroundColor: t.faintStrong,
          borderColor: t.brand,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1.5,
          minHeight: MOBILE_SIZES.controlHeight,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
          justifyContent: 'center',
        },
        buttonPrimary: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.sm,
          minHeight: MOBILE_SIZES.controlHeightLg,
          marginBottom: 12,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
          justifyContent: 'center',
        },
        buttonText: { color: t.text, fontWeight: 'bold', fontSize: MOBILE_TYPE.bodyStrong },
        buttonTextOn: { ...t.buttonPrimaryText, fontSize: MOBILE_TYPE.bodyStrong },
        description: {
          color: t.subText,
          fontSize: MOBILE_TYPE.bodyStrong,
          marginBottom: 20,
          textAlign: 'center',
        },
        emptyTitle: {
          color: t.text,
          fontSize: 18,
          fontWeight: '700',
          marginBottom: 12,
          textAlign: 'center',
        },
        emptyWrap: {
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        },
        overlayHeader: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,   // unificado
          borderWidth: 1,
          borderRadius: WEB_PANEL_RADIUS,
          marginHorizontal: 20,
          paddingTop: 30,
          paddingBottom: 10,
          paddingHorizontal: 16,
          // sombra sutil ligada a brand
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,   // unificado
          borderWidth: 1,
          borderRadius: WEB_PANEL_RADIUS,
          margin: 20,
          padding: 16,
          // sombra sutil
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        scroll: {
          backgroundColor: 'transparent',
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: 24,
          paddingBottom: 32,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          minHeight: Math.max(420, winH - 80),
        },
        subtitle: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          marginTop: 8,
          textAlign: 'center',
          lineHeight: 22,
          paddingHorizontal: 8,
        },
        helperLine: {
          color: t.subText,
          fontSize: 13,
          textAlign: 'center',
          lineHeight: 20,
          marginTop: 14,
          marginBottom: 16,
          paddingHorizontal: 8,
        },
        featureLine: {
          color: t.subText,
          fontSize: 13,
          lineHeight: 20,
          marginTop: 10,
          paddingHorizontal: 4,
        },
        /** Título del plan: tipografía principal de la org (features.text_color → t.text), no solo acento/borde. */
        title: {
          color: t.text,
          fontSize: 24,
          fontWeight: 'bold',
          textAlign: 'center',
        },
      }),
    [t, winH],
  );

  if (!plan) {
    return (
      <BackgroundWrapper>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{tStr('plan_detail_no_plan')}</Text>
          <BackNavButton onPress={handleVolver} label={tStr('config_back')} style={styles.buttonOutline} />
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper plan={plan}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.overlayHeader}>
          <Text style={styles.title}>{plan.title}</Text>
          {!!plan.subtitle && <Text style={styles.subtitle}>{plan.subtitle}</Text>}
        </View>

        <NeoPanel style={styles.panel}>
          {!!plan.description && <Text style={styles.description}>{plan.description}</Text>}
          <Text style={styles.helperLine}>Elegí cómo arrancar hoy y te guiamos paso a paso.</Text>
          <Text style={styles.featureLine}>✓ Vista clara de horarios y disponibilidad</Text>
          <Text style={styles.featureLine}>✓ Contratación simple desde tu panel</Text>
          <Text style={styles.featureLine}>✓ Gestión de reservas en segundos</Text>
          {plan.id === 'pase_total' && (
            <Text style={styles.description}>{tStr('plan_detail_pase_total_desc')}</Text>
          )}
          {plan.id === 'evolucion' && (
            <Text style={styles.description}>{tStr('plan_detail_evolucion_desc')}</Text>
          )}

          {plan.id !== 'evolucion' && plan.id !== 'pase_total' && (
            <TouchableOpacity style={styles.buttonPrimary} onPress={handleVerHorariosClaseGratis}>
              <Text style={styles.buttonTextOn}>{tStr('plan_detail_free_class')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.buttonPrimary} onPress={handleVerAbonos}>
            <Text style={styles.buttonTextOn}>{tStr('plan_detail_see_abonos')}</Text>
          </TouchableOpacity>

          <BackNavButton onPress={handleVolver} label={tStr('plan_detail_back_plans')} style={styles.buttonOutline} />
        </NeoPanel>
      </ScrollView>
    </BackgroundWrapper>
  );
}