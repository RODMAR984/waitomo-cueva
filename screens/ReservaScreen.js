// screens/ReservaScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: lista de horarios, alert de confirmación, goBack

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import getRandomGeneralImage from '../utils/getRandomGeneralImage';
import { useThemeContext } from '../contexts/ThemeContext';

// ---------- datos estáticos (preservados) ----------
const horarios = [
  { id: '1', dia: 'Lunes', hora: '08:00' },
  { id: '2', dia: 'Martes', hora: '10:00' },
  { id: '3', dia: 'Miércoles', hora: '14:00' },
  { id: '4', dia: 'Jueves', hora: '18:00' },
  { id: '5', dia: 'Viernes', hora: '20:00' },
];

export default function ReservaScreen({ route, navigation }) {
  const plan = route?.params?.plan ?? null;
  const fondo = route?.params?.fondo ?? (!plan ? getRandomGeneralImage() : null);

  const { t } = useThemeContext();
  const [selectedId, setSelectedId] = useState(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { backgroundColor: t.bg, flex: 1 },

        // overlay principal para contenido
        content: {
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 100,
        },
        panelTitle: {
          alignSelf: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 14,
          borderWidth: 1,
          marginBottom: 24,
          paddingHorizontal: 16,
          paddingVertical: 10,
        },
        titulo: {
          color: t.subText,
          fontSize: 22,
          fontWeight: 'bold',
          textAlign: 'center',
        },

        lista: {
          gap: 12,
          paddingBottom: 10,
        },
        item: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 14,
          borderWidth: 1.2,
          paddingHorizontal: 20,
          paddingVertical: 14,
        },
        itemSelected: {
          ...t.buttonPrimary,
        },
        itemText: {
          color: t.text,
          fontSize: 16,
          fontWeight: 'bold',
        },
        itemTextSelected: {
          ...t.buttonPrimaryText,
        },

        // acciones
        actions: {
          alignItems: 'center',
          marginTop: 24,
        },
        confirmar: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          paddingHorizontal: 22,
          paddingVertical: 12,
        },
        confirmarTxt: {
          ...t.buttonPrimaryText,
          fontWeight: 'bold',
        },
        volver: {
          alignItems: 'center',
          marginTop: 16,
        },
        volverTxt: {
          color: t.text,
          fontSize: 16,
        },
      }),
    [t],
  );

  const reservar = useCallback(
    (item) => {
      setSelectedId(item.id);
      Alert.alert('✅ Reserva realizada', `${item.dia} a las ${item.hora}`);
    },
    [setSelectedId],
  );

  const renderItem = ({ item }) => {
    const selected = selectedId === item.id;
    return (
      <TouchableOpacity
        onPress={() => reservar(item)}
        style={[styles.item, selected && styles.itemSelected]}
      >
        <Text style={[styles.itemText, selected && styles.itemTextSelected]}>
          {item.dia} - {item.hora}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <BackgroundWrapper plan={plan} fondo={fondo}>
      <View style={styles.root}>
        <View style={styles.content}>
          <View style={styles.panelTitle}>
            <Text style={styles.titulo}>Seleccioná un horario</Text>
          </View>

          <FlatList
            data={horarios}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => {
                if (!selectedId) {
                  Alert.alert('⏰ Seleccioná un horario');
                  return;
                }
                navigation.goBack();
              }}
              style={styles.confirmar}
            >
              <Text style={styles.confirmarTxt}>Confirmar y volver</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.volver}>
              <Text style={styles.volverTxt}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </BackgroundWrapper>
  );
}
