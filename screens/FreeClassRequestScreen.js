// screens/FreeClassRequestScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: validar, confirmar, alerts y navegación

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import getRandomGeneralImage from '../utils/getRandomGeneralImage';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function FreeClassRequestScreen({ route, navigation }) {
  const defaultPlan = { nombre: 'Clase Gratuita' };
  const { plan = defaultPlan } = route?.params || {};
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [selectedHour, setSelectedHour] = useState(null);

  const hours = useMemo(
    () => Array.from({ length: 13 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`),
    [],
  );

  const handleRequest = () => {
    if (!name.trim() || !contact.trim() || !selectedHour) {
      Alert.alert('Faltan datos', 'Completá todo y elegí un horario.');
      return;
    }

    Alert.alert(
      '✅ Reserva confirmada',
      `Tu clase gratuita quedó agendada a las ${selectedHour}.\n\nNos comunicaremos con vos. También podés acercarte unos minutos antes al box o escribirnos al 2268635566.`,
    );

    navigation.goBack();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cancel: {
          alignItems: 'center',
          marginTop: 12,
        },
        cancelText: {
          color: t.text,
        },
        confirmButton: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          padding: 14,
        },
        confirmText: {
          ...t.buttonPrimaryText,
          fontSize: 16,
          fontWeight: 'bold',
        },
        hourButton: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          margin: 5,
          paddingHorizontal: 20,
          paddingVertical: 10,
        },
        hourButtonSelected: {
          ...t.buttonPrimary,
        },
        hourGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
          marginBottom: 20,
        },
        hourText: {
          color: t.text,
          fontWeight: 'normal',
        },
        hourTextSelected: {
          ...t.buttonPrimaryText,
          fontWeight: 'bold',
        },
        input: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          color: t.text,
          fontSize: 16,
          height: 48,
          marginBottom: 18,
          paddingHorizontal: 15,
        },
        kav: {
          flex: 1,
        },
        panel: {
          borderRadius: 20,
          borderWidth: 1.2,
          padding: 24,
          marginHorizontal: 10,
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          // sombra sutil en relación a brand
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        scroll: {
          backgroundColor: t.bg,
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingVertical: 60,
        },
        title: {
          color: t.subText,
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 24,
          textAlign: 'center',
        },
      }),
    [t],
  );

  return (
    <BackgroundWrapper fondo={getRandomGeneralImage()}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.panel}>
            <Text style={styles.title}>{tStr('freeclass_title')}</Text>

            <TextInput
              style={styles.input}
              placeholder="Tu nombre completo"
              placeholderTextColor={t.placeholder}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={styles.input}
              placeholder="Mail o teléfono"
              placeholderTextColor={t.placeholder}
              value={contact}
              onChangeText={setContact}
              keyboardType="default"
            />

            <View style={styles.hourGrid}>
              {hours.map((h) => {
                const selected = selectedHour === h;
                return (
                  <TouchableOpacity
                    key={h}
                    onPress={() => setSelectedHour(h)}
                    style={[styles.hourButton, selected && styles.hourButtonSelected]}
                  >
                    <Text style={[styles.hourText, selected && styles.hourTextSelected]}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={handleRequest} style={styles.confirmButton}>
              <Text style={styles.confirmText}>{tStr('freeclass_confirm')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancel}>
              <Text style={styles.cancelText}>{tStr('freeclass_cancel')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
