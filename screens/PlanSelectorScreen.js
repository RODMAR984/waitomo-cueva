// screens/PlanSelectorScreen.js - CON EFECTO DE LATIDO EN TARJETAS
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
} from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

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

export default function PlanSelectorScreen({ navigation }) {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { profile } = useAuth() || {};
  const [plansFromApi, setPlansFromApi] = useState([]);
  const [loading, setLoading] = useState(true);

  const organizationId = profile?.organization_id || null;

  useEffect(() => {
    if (!organizationId) {
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
          .eq('organization_id', organizationId)
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
    return () => { alive = false; };
  }, [organizationId]);

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
    return FALLBACK_PLAN_IDS;
  }, [plansFromApi]);

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
          paddingTop: 100,
          paddingBottom: 80,
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
          borderColor: t.borderStrong, // 🔹 borde bien cian
          shadowColor: t.borderStrong, // 🔹 glow cian
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
          color: t.brand, // 🔹 título bien cian
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
      }),
    [t],
  );

  const goToPlan = (plan) => {
    navigation.navigate('PlanDetail', { plan });
  };

  const renderPlanCard = (plan, index) => {
    const animatedStyle = {
      transform: [{ scale: (index < animatedValues.length ? animatedValues[index] : animatedValues[0]) }],
    };
    const key = `${plan.id}_${index}`;
    const disabled = !plan.active;
    const titleKey = `plan_${plan.id}_title`;
    const subtitleKey = `plan_${plan.id}_subtitle`;
    const planWithTitle = {
      ...plan,
      title: plan.title != null ? plan.title : tStr(titleKey),
      subtitle: plan.subtitle != null ? plan.subtitle : tStr(subtitleKey),
    };

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
            <Text style={styles.subtitle}>{planWithTitle.subtitle}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const planPairs = [];
  for (let i = 0; i < displayPlans.length; i += 2) {
    planPairs.push(displayPlans.slice(i, i + 2));
  }

  return (
    <BackgroundWrapper screen="PlanSelector">
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.header}>{tStr('plan_selector_header')}</Text>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={t.brand} />
            </View>
          ) : (
            planPairs.map((pair, rowIndex) => (
              <View key={`row_${rowIndex}`} style={styles.row}>
                {pair.map((p, idx) => renderPlanCard(p, rowIndex * 2 + idx))}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </BackgroundWrapper>
  );
}
