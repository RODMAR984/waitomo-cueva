// screens/AsignarCoachesScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext ni isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: autoriza superadmin, asigna/quita coaches por plan

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import PropTypes from 'prop-types';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';

// ---------- fallback de planes (si navegación no provee) ----------
const DEFAULT_PLANS = [
  { id: 'cross_training', nombre: 'Cross Training' },
  { id: 'oly', nombre: 'Oly' },
  { id: 'evolucion', nombre: 'Ciclo Evolución' },
  { id: 'open_box', nombre: 'Open Box' },
  { id: 'yoga', nombre: 'Yoga' },
];

export default function AsignarCoachesScreen({ route }) {
  const { t } = useThemeContext();
  const {
    currentUser,
    isSuperAdmin,
    coachesByPlan,
    assignCoachToPlan,
    removeCoachFromPlan,
  } = useAuth();

  const plans = route?.params?.plans || DEFAULT_PLANS;

  // solo superadmin puede gestionar asignaciones
  const autorizado = isSuperAdmin?.(currentUser?.id);

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
            placeholder="userId (email, uid, etc.)"
            placeholderTextColor={placeholderColor}
            value={inputByPlan[item.id] || ''}
            onChangeText={(t0) =>
              setInputByPlan((prev) => ({ ...prev, [item.id]: t0 }))
            }
            style={styles.input}
          />
          <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item.id)}>
            <Text style={styles.addTxt}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {/* listado de coaches */}
        {list.length === 0 ? (
          <Text style={styles.emptyText}>Sin coaches asignados.</Text>
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
                  <Text style={styles.delTxt}>Quitar</Text>
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
        <Text style={styles.centerMsg}>No autorizado</Text>
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
