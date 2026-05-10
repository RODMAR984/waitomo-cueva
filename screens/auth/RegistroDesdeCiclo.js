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
import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import getRandomGeneralImage from '../../utils/getRandomGeneralImage';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

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
          borderRadius: MOBILE_RADII.md,
          marginBottom: 16,
          padding: 14,
        },
        buttonText: {
          ...t.buttonPrimaryText,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: 'bold',
        },
        container: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1.5,
          marginHorizontal: MOBILE_SPACING.xl,
          padding: MOBILE_SPACING.xxl,
        },
        input: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          marginBottom: 20,
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: 10,
        },
        kav: { flex: 1 },
        scroll: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 60,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        title: {
          color: t.subText,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: MOBILE_SPACING.xxl,
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
