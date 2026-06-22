// screens/RegistroEvolucionScreen.js — Ciclo Evolución: planes personalizados
// No tiene abonos ni compra en la app: se contacta al usuario y se envía la rutina.
// Tras enviar el formulario se ofrece crear cuenta (opcional) para seguimiento en la app.

import React, { useMemo, useState } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { confirmAction, showAppAlert } from '../../utils/confirmAction';
import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import getRandomGeneralImage from '../../utils/getRandomGeneralImage';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';
import { authScrollKeyboardDismissMode, authScrollContentJustify } from '../../components/AuthWebFormShell';

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

  const goCreateAccount = () => {
    const evTitle = tStr('registro_evolucion_title');
    navigation.navigate('CreateAccount', {
      plan: { ...plan, id: plan?.id || 'evolucion', title: plan?.title || evTitle },
      abono: null,
      fromEvolucion: true,
    });
  };

  const handleEnviar = async () => {
    if (!nivel) {
      showAppAlert(tStr('reg_evol_alert_pick_level_title'), tStr('reg_evol_alert_pick_level_body'));
      return;
    }
    if (!nombre.trim() || !objetivo.trim()) {
      showAppAlert(tStr('reg_evol_alert_missing_title'), tStr('reg_evol_alert_missing_body'));
      return;
    }
    const thanksBody = tStr('reg_evol_success_body')
      .replace('{{name}}', nombre.trim())
      .replace('{{level}}', nivel.toUpperCase());

    if (Platform.OS === 'web') {
      showAppAlert(tStr('reg_evol_success_title'), thanksBody);
      const createAccount = await confirmAction({
        title: tStr('reg_evol_success_title'),
        message: tStr('reg_evol_success_create_prompt'),
        confirmLabel: tStr('reg_evol_create_account'),
        cancelLabel: tStr('config_back'),
      });
      if (createAccount) goCreateAccount();
      else navigation.goBack();
      return;
    }

    Alert.alert(tStr('reg_evol_success_title'), thanksBody, [
      { text: tStr('config_back'), onPress: () => navigation.goBack() },
      { text: tStr('reg_evol_create_account'), onPress: goCreateAccount },
    ]);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.lg,
        },
        buttonText: {
          ...t.buttonPrimaryText,
          fontSize: MOBILE_TYPE.bodyStrong,
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
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1.5,
          borderColor: t.overlayBorder,
          paddingVertical: 10,
          paddingHorizontal: MOBILE_SPACING.sm,
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
          fontSize: MOBILE_TYPE.body,
        },
        levelTitleActive: {
          color: t.brand,
          fontWeight: '800',
        },
        levelSubtitle: {
          color: t.subText,
          fontSize: MOBILE_TYPE.meta,
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
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          marginBottom: 16,
          padding: 14,
        },
        // PANEL — brillo unificado
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderWidth: 1.5,
          borderRadius: MOBILE_RADII.lg,
          padding: MOBILE_SPACING.xxl,
          // sombra sutil ligada a la marca
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
        },
        scroll: {
          flexGrow: 1,
          justifyContent: authScrollContentJustify(),
          marginTop: height * 0.15,
          padding: MOBILE_SPACING.xl,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        title: {
          color: t.brand,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: 8,
          textAlign: 'center',
        },
        info: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          marginBottom: 20,
          textAlign: 'center',
          lineHeight: 20,
        },
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={plan}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={authScrollKeyboardDismissMode}
      >
        <NeoPanel style={styles.panel}>
          <BackNavButton onPress={() => navigation.goBack()} />
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
            placeholder={tStr('reg_evol_ph_name')}
            placeholderTextColor={t.placeholder}
            value={nombre}
            onChangeText={setNombre}
          />

          <TextInput
            style={styles.input}
            placeholder={tStr('reg_evol_ph_goal')}
            placeholderTextColor={t.placeholder}
            value={objetivo}
            onChangeText={setObjetivo}
            multiline
          />

          <TouchableOpacity onPress={handleEnviar} style={styles.button}>
            <Text style={styles.buttonText}>{tStr('registro_evolucion_send')}</Text>
          </TouchableOpacity>

          {Platform.OS !== 'web' ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancel}>
              <Text style={styles.cancelText}>{tStr('config_back')}</Text>
            </TouchableOpacity>
          ) : null}
        </NeoPanel>
      </ScrollView>
    </BackgroundWrapper>
  );
}
