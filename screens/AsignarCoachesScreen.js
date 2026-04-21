// screens/AsignarCoachesScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext ni isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: autoriza superadmin, asigna/quita coaches por plan

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { useThemeContext } from '../contexts/ThemeContext';

// ---------- fallback de planes (si navegación no provee) ----------
const DEFAULT_PLANS = [
  { id: 'cross_training', nombre: 'Cross Training' },
  { id: 'oly', nombre: 'Oly' },
  { id: 'evolucion', nombre: 'Ciclo Evolución' },
  { id: 'open_box', nombre: 'Open Box' },
  { id: 'yoga', nombre: 'Yoga' },
];

const storageKeyCoaches = (orgId) =>
  `waitomo_coaches_by_plan_v1_${orgId || 'none'}`;

export default function AsignarCoachesScreen({ route }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { currentUser, isSuperAdmin, organization, organizationsOwnedByUser } = useAuth();

  const plans = route?.params?.plans || DEFAULT_PLANS;

  const [coachesByPlan, setCoachesByPlan] = useState({});

  const orgId = organization?.id;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!orgId) {
        if (alive) setCoachesByPlan({});
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(storageKeyCoaches(orgId));
        if (!alive) return;
        const parsed = raw ? JSON.parse(raw) : {};
        setCoachesByPlan(typeof parsed === 'object' && parsed ? parsed : {});
      } catch {
        if (alive) setCoachesByPlan({});
      }
    })();
    return () => {
      alive = false;
    };
  }, [orgId]);

  const assignCoachToPlan = useCallback(
    async (planId, userId) => {
      const uid = (userId || '').trim();
      if (!uid || !planId || !orgId) return;
      setCoachesByPlan((prev) => {
        const list = [...(prev[planId] || [])];
        if (list.includes(uid)) return prev;
        const next = { ...prev, [planId]: [...list, uid] };
        AsyncStorage.setItem(storageKeyCoaches(orgId), JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [orgId],
  );

  const removeCoachFromPlan = useCallback(
    async (planId, userId) => {
      const uid = (userId || '').trim();
      if (!uid || !planId || !orgId) return;
      setCoachesByPlan((prev) => {
        const list = (prev[planId] || []).filter((x) => x !== uid);
        const next = { ...prev, [planId]: list };
        AsyncStorage.setItem(storageKeyCoaches(orgId), JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [orgId],
  );

  const isOwnerOfCurrentOrg = (organizationsOwnedByUser || []).some(
    (o) => o?.id === organization?.id,
  );

  const autorizado =
    !!isSuperAdmin?.(currentUser?.id) || (!!organization?.id && isOwnerOfCurrentOrg);

  const [inputByPlan, setInputByPlan] = useState({});

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingBottom: 12,
        },
        backBtn: { padding: 8, marginLeft: -8 },
        title: {
          flex: 1,
          color: t.brandText ?? t.brand,
          fontSize: 18,
          fontWeight: '800',
          marginRight: 8,
        },
        scroll: { flex: 1 },
        scrollContent: {
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 28) + 24,
        },
        section: { marginBottom: 20 },
        card: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 16,
          borderWidth: 1,
          paddingVertical: 12,
          paddingHorizontal: 14,
          marginBottom: 10,
        },
        planTitle: {
          color: t.text,
          fontSize: 17,
          fontWeight: '700',
        },
        planId: { color: t.subText, fontSize: 12, marginTop: 4 },
        row: {
          alignItems: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 10,
        },
        input: {
          backgroundColor: t.inputBg ?? t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          color: t.text,
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 120,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        addBtn: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          justifyContent: 'center',
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        addTxt: { ...t.buttonPrimaryText, fontWeight: '700' },
        coachRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
          paddingVertical: 8,
          paddingHorizontal: 4,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.overlayBorder,
        },
        delBtn: {
          alignItems: 'center',
          backgroundColor: t.danger,
          borderRadius: 10,
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        delTxt: { ...t.buttonDangerText, fontWeight: '700' },
        uidText: { color: t.text, flex: 1, marginRight: 8, fontSize: 14 },
        emptyText: { color: t.placeholder, marginTop: 10, fontSize: 14 },
        centerWrap: {
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingBottom: 40,
        },
        centerMsg: { color: t.text, fontSize: 16, textAlign: 'center', lineHeight: 22 },
      }),
    [t, insets.top, insets.bottom],
  );

  const placeholderColor = t.placeholder;

  const onAdd = async (planId) => {
    const userId = (inputByPlan[planId] || '').trim();
    if (!userId) return;
    await assignCoachToPlan(planId, userId);
    setInputByPlan((prev) => ({ ...prev, [planId]: '' }));
  };

  const headerEl = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={26} color={t.text} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={2}>
        {tStr('admin_nav_assign_coaches')}
      </Text>
    </View>
  );

  if (!autorizado) {
    return (
      <BackgroundWrapper screen="admin">
        <View style={styles.root}>
          {headerEl}
          <View style={styles.centerWrap}>
            <Text style={styles.centerMsg}>{tStr('assign_coach_unauthorized')}</Text>
          </View>
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper screen="admin">
      <View style={styles.root}>
        {headerEl}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {plans.map((item) => {
            const list = coachesByPlan?.[item.id] || [];
            return (
              <View key={item.id} style={styles.section}>
                <View style={styles.card}>
                  <Text style={styles.planTitle}>{item.nombre}</Text>
                  <Text style={styles.planId}>{item.id}</Text>

                  <View style={styles.row}>
                    <TextInput
                      placeholder={tStr('assign_coach_ph_user')}
                      placeholderTextColor={placeholderColor}
                      value={inputByPlan[item.id] || ''}
                      onChangeText={(t0) =>
                        setInputByPlan((prev) => ({ ...prev, [item.id]: t0 }))
                      }
                      style={styles.input}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item.id)}>
                      <Text style={styles.addTxt}>{tStr('assign_coach_add')}</Text>
                    </TouchableOpacity>
                  </View>

                  {list.length === 0 ? (
                    <Text style={styles.emptyText}>{tStr('assign_coach_empty')}</Text>
                  ) : (
                    list.map((uid) => (
                      <View key={`${item.id}-${uid}`} style={styles.coachRow}>
                        <Text style={styles.uidText} selectable>
                          {uid}
                        </Text>
                        <TouchableOpacity
                          style={styles.delBtn}
                          onPress={() => removeCoachFromPlan(item.id, uid)}
                        >
                          <Text style={styles.delTxt}>{tStr('assign_coach_remove')}</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </BackgroundWrapper>
  );
}

AsignarCoachesScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      plans: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          nombre: PropTypes.string.isRequired,
        }),
      ),
    }),
  }),
};
