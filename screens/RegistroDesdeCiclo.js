// screens/RegistroDesdeCiclo.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: validar campos, alertas y navegación

import React, { useMemo, useState } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import BackNavButton from '../components/BackNavButton';
import getRandomGeneralImage from '../utils/getRandomGeneralImage';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../theme/webSpec';

export default function RegistroDesdeCiclo({ navigation, route }) {
  const { plan = { nombre: 'Ciclo Evolución' } } = route?.params || {};
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [contacto, setContacto] = useState('');

  const handleContinuar = () => {
    if (!nombre.trim() || !objetivo.trim() || !contacto.trim()) {
      Alert.alert(tStr('reg_ciclo_incomplete_title'), tStr('reg_ciclo_incomplete_body'));
      return;
    }

    Alert.alert(tStr('reg_ciclo_sent_title'), tStr('reg_ciclo_sent_body'));
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 12,
          marginBottom: 16,
          padding: 14,
        },
        buttonText: {
          ...t.buttonPrimaryText,
          fontSize: 16,
          fontWeight: 'bold',
        },
        container: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: WEB_PANEL_RADIUS,
          borderWidth: 1.5,
          marginHorizontal: 20,
          padding: 24,
        },
        input: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 12,
          borderWidth: 1,
          color: t.text,
          fontSize: 16,
          marginBottom: 20,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        kav: { flex: 1 },
        scroll: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingVertical: 60,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        title: {
          color: t.subText,
          fontSize: 22,
          fontWeight: 'bold',
          marginBottom: 24,
          textAlign: 'center',
        },
        volver: {
          alignItems: 'center',
          padding: 10,
        },
        volverText: {
          color: t.text,
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
          <View style={styles.container}>
            <BackNavButton onPress={() => navigation.goBack()} />
            <Text style={styles.title}>{tStr('reg_ciclo_title')}</Text>

            <TextInput
              placeholder={tStr('reg_ciclo_ph_name')}
              placeholderTextColor={t.placeholder}
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
            />

            <TextInput
              placeholder={tStr('reg_ciclo_ph_goal')}
              placeholderTextColor={t.placeholder}
              style={styles.input}
              value={objetivo}
              onChangeText={setObjetivo}
            />

            <TextInput
              placeholder={tStr('reg_ciclo_ph_contact')}
              placeholderTextColor={t.placeholder}
              style={styles.input}
              value={contacto}
              onChangeText={setContacto}
              keyboardType="default"
            />

            <TouchableOpacity style={styles.button} onPress={handleContinuar}>
              <Text style={styles.buttonText}>{tStr('reg_ciclo_continue')}</Text>
            </TouchableOpacity>

            {Platform.OS !== 'web' ? (
              <TouchableOpacity style={styles.volver} onPress={() => navigation.goBack()}>
                <Text style={styles.volverText}>{tStr('reg_ciclo_back')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
