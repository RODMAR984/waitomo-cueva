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
  FlatList,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
        container: {
          backgroundColor: t.bg,
          flex: 1,
        },
        listContainer: {
          padding: 16,
          paddingBottom: 80,
        },

        // tarjeta/encabezado de plan
        card: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 16,
          borderWidth: 1,
          padding: 12,
        },
        planTitle: {
          color: t.subText,
          fontSize: 18,
          fontWeight: '700',
        },

        // filas y bloques
        block: { marginBottom: 14 },
        row: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: 8,
          justifyContent: 'space-between',
          paddingVertical: 6,
        },

        // input + placeholder
        input: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          color: t.text,
          flex: 1,
          paddingHorizontal: 10,
          paddingVertical: 8,
        },

        // botones
        addBtn: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        addTxt: { ...t.buttonPrimaryText, fontWeight: '700' },

        delBtn: {
          alignItems: 'center',
          backgroundColor: t.danger,
          borderRadius: 10,
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingVertical: 6,
        },
        delTxt: { ...t.buttonDangerText, fontWeight: '800' },

        // textos
        uidText: { color: t.text },
        emptyText: { color: t.empty, marginTop: 8 },

        // centro (no autorizado)
        center: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          padding: 24,
        },
        centerMsg: { color: t.text, fontSize: 16, textAlign: 'center' },
      }),
    [t],
  );

  const placeholderColor = t.placeholder;

  const onAdd = async (planId) => {
    const userId = (inputByPlan[planId] || '').trim();
    if (!userId) return;
    await assignCoachToPlan(planId, userId);
    setInputByPlan((prev) => ({ ...prev, [planId]: '' }));
  };

  const renderItem = ({ item }) => {
    const list = coachesByPlan?.[item.id] || [];
    return (
      <View style={styles.block}>
        {/* header del plan */}
        <View style={styles.card}>
          <Text style={styles.planTitle}>
            {item.nombre}
            {' '}
            (
            {item.id}
            )
          </Text>
        </View>

        {/* fila de alta */}
        <View style={styles.row}>
          <TextInput
            placeholder={tStr('assign_coach_ph_user')}
            placeholderTextColor={placeholderColor}
            value={inputByPlan[item.id] || ''}
            onChangeText={(t0) =>
              setInputByPlan((prev) => ({ ...prev, [item.id]: t0 }))
            }
            style={styles.input}
          />
          <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item.id)}>
            <Text style={styles.addTxt}>{tStr('assign_coach_add')}</Text>
          </TouchableOpacity>
        </View>

        {/* listado de coaches */}
        {list.length === 0 ? (
          <Text style={styles.emptyText}>{tStr('assign_coach_empty')}</Text>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(uid) => `${item.id}-${uid}`}
            renderItem={({ item: uid }) => (
              <View style={styles.row}>
                <Text style={styles.uidText}>{uid}</Text>
                <TouchableOpacity
                  style={styles.delBtn}
                  onPress={() => removeCoachFromPlan(item.id, uid)}
                >
                  <Text style={styles.delTxt}>{tStr('assign_coach_remove')}</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    );
  };

  if (!autorizado) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerMsg}>{tStr('assign_coach_unauthorized')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.listContainer}
        data={plans}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
      />
    </View>
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
