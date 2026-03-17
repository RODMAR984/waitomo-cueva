// screens/RegistroEvolucionScreen.js — Ciclo Evolución: planes personalizados
// No tiene abonos ni compra en la app: se contacta al usuario y se envía la rutina.
// Tras enviar el formulario se ofrece crear cuenta (opcional) para seguimiento en la app.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import getRandomGeneralImage from '../utils/getRandomGeneralImage';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

const { height } = Dimensions.get('window');

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full =
    clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function RegistroEvolucionScreen({ route, navigation }) {
  const routePlan = route?.params?.plan;
  const defaultPlan = {
    id: 'evolucion',
    title: 'Ciclo Evolución',
    image: getRandomGeneralImage(),
  };
  const plan = routePlan || defaultPlan;

  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [nivel, setNivel] = useState(null); // 'rookie' | 'scaled' | 'atleta'

  const handleEnviar = () => {
    if (!nivel) {
      Alert.alert('Falta elegir el plan', 'Elegí Rookie, Scaled o Atleta.');
      return;
    }
    if (!nombre.trim() || !objetivo.trim()) {
      Alert.alert('Faltan datos', 'Completá tu nombre y objetivo.');
      return;
    }
    Alert.alert(
      '¡Listo!',
      `Gracias ${nombre.trim()}. Registramos tu interés en Ciclo Evolución (${nivel.toUpperCase()}). Te contactaremos para enviarte tu rutina personalizada. No hay abonos ni pago en la app para este plan.`,
      [
        { text: 'Volver', onPress: () => navigation.goBack() },
        {
          text: 'Crear cuenta',
          onPress: () => {
            navigation.navigate('CreateAccount', {
              plan: { ...plan, id: plan?.id || 'evolucion', title: plan?.title || 'Ciclo Evolución' },
              abono: null,
              fromEvolucion: true,
            });
          },
        },
      ]
    );
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 12,
          padding: 16,
        },
        buttonText: {
          ...t.buttonPrimaryText,
          fontSize: 16,
          fontWeight: 'bold',
          textAlign: 'center',
        },
        cancel: {
          alignItems: 'center',
          marginTop: 14,
        },
        cancelText: {
          color: t.text,
        },
        // INPUTS — brillo unificado
        levelRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 16,
        },
        levelButton: {
          flex: 1,
          marginHorizontal: 4,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: t.overlayBorder,
          paddingVertical: 10,
          paddingHorizontal: 8,
          alignItems: 'center',
          backgroundColor: t.boxBg,
        },
        levelButtonActive: {
          borderWidth: 2.5,
          borderColor: t.brand,
          backgroundColor: hexToRgba(t.brand, 0.25),
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
          elevation: 6,
        },
        levelTitle: {
          color: t.text,
          fontWeight: '700',
          fontSize: 13,
        },
        levelTitleActive: {
          color: t.brand,
          fontWeight: '800',
        },
        levelSubtitle: {
          color: t.subText,
          fontSize: 11,
          textAlign: 'center',
          marginTop: 2,
        },
        levelSubtitleActive: {
          color: t.brand,
          opacity: 0.9,
        },
        input: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          color: t.text,
          fontSize: 16,
          marginBottom: 16,
          padding: 14,
        },
        // PANEL — brillo unificado
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderWidth: 1.5,
          borderRadius: 20,
          padding: 24,
          // sombra sutil ligada a la marca
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
        },
        scroll: {
          flexGrow: 1,
          justifyContent: 'center',
          marginTop: height * 0.15,
          padding: 20,
        },
        title: {
          color: t.brand,
          fontSize: 22,
          fontWeight: 'bold',
          marginBottom: 8,
          textAlign: 'center',
        },
        info: {
          color: t.subText,
          fontSize: 14,
          marginBottom: 20,
          textAlign: 'center',
          lineHeight: 20,
        },
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={plan}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <Text style={styles.title}>{tStr('registro_evolucion_title')}</Text>
          <Text style={styles.info}>{tStr('registro_evolucion_info')}</Text>

          <View style={styles.levelRow}>
            <TouchableOpacity
              style={[
                styles.levelButton,
                nivel === 'rookie' && styles.levelButtonActive,
              ]}
              onPress={() => setNivel('rookie')}
            >
              <Text style={[styles.levelTitle, nivel === 'rookie' && styles.levelTitleActive]}>{tStr('registro_evolucion_rookie')}</Text>
              <Text style={[styles.levelSubtitle, nivel === 'rookie' && styles.levelSubtitleActive]}>{tStr('registro_evolucion_rookie_sub')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.levelButton,
                nivel === 'scaled' && styles.levelButtonActive,
              ]}
              onPress={() => setNivel('scaled')}
            >
              <Text style={[styles.levelTitle, nivel === 'scaled' && styles.levelTitleActive]}>{tStr('registro_evolucion_scaled')}</Text>
              <Text style={[styles.levelSubtitle, nivel === 'scaled' && styles.levelSubtitleActive]}>{tStr('registro_evolucion_scaled_sub')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.levelButton,
                nivel === 'atleta' && styles.levelButtonActive,
              ]}
              onPress={() => setNivel('atleta')}
            >
              <Text style={[styles.levelTitle, nivel === 'atleta' && styles.levelTitleActive]}>{tStr('registro_evolucion_atleta')}</Text>
              <Text style={[styles.levelSubtitle, nivel === 'atleta' && styles.levelSubtitleActive]}>{tStr('registro_evolucion_atleta_sub')}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Tu nombre"
            placeholderTextColor={t.placeholder}
            value={nombre}
            onChangeText={setNombre}
          />

          <TextInput
            style={styles.input}
            placeholder="Contanos tu objetivo (fuerza, bajar grasa, etc.)"
            placeholderTextColor={t.placeholder}
            value={objetivo}
            onChangeText={setObjetivo}
            multiline
          />

          <TouchableOpacity onPress={handleEnviar} style={styles.button}>
            <Text style={styles.buttonText}>{tStr('registro_evolucion_send')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancel}>
            <Text style={styles.cancelText}>{tStr('config_back')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
