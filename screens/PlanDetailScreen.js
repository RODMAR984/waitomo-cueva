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
} from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { usePlanContext } from '../contexts/PlanContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { useAuth } from '../contexts/AuthContext';
import { IMAGENES_POR_PLAN } from '../utils/imagenesFijas';
import { normalizePlanKey } from '../utils/planKeyNormalize';

export default function PlanDetailScreen({ route, navigation }) {
  const plan = route?.params?.plan;
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
          borderRadius: 10,
          borderWidth: 1.5,
          padding: 14,
        },
        buttonPrimary: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          marginBottom: 12,
          padding: 14,
        },
        buttonText: { color: t.text, fontWeight: 'bold' },
        buttonTextOn: t.buttonPrimaryText,
        description: {
          color: t.subText,
          fontSize: 15,
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
          borderRadius: 12,
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
          borderRadius: 20,
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
          justifyContent: 'flex-end',
          paddingBottom: 20,
        },
        subtitle: {
          color: t.subText,
          fontSize: 16,
          marginTop: 4,
          textAlign: 'center',
        },
        /** Título del plan: tipografía principal de la org (features.text_color → t.text), no solo acento/borde. */
        title: {
          color: t.text,
          fontSize: 26,
          fontWeight: 'bold',
          textAlign: 'center',
        },
      }),
    [t],
  );

  if (!plan) {
    return (
      <BackgroundWrapper>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{tStr('plan_detail_no_plan')}</Text>
          <TouchableOpacity onPress={handleVolver} style={styles.buttonOutline}>
            <Text style={styles.buttonText}>{tStr('config_back')}</Text>
          </TouchableOpacity>
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

        <View style={styles.panel}>
          {!!plan.description && <Text style={styles.description}>{plan.description}</Text>}
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

          <TouchableOpacity onPress={handleVolver} style={styles.buttonOutline}>
            <Text style={styles.buttonText}>{tStr('plan_detail_back_plans')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}