// screens/ProgresoScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: fondo + mensaje centrado

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BackNavButton from '../../components/BackNavButton';
import ScreenShell from '../../components/ScreenShell';
import { useThemeContext } from '../../contexts/ThemeContext';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function ProgresoScreen() {
  const navigation = useNavigation();
  const { t } = useThemeContext();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: MOBILE_SPACING.xl,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          // capa sutil para asegurar legibilidad del texto
          backgroundColor: hexToRgba(t.bg, 0.0),
        },
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          paddingHorizontal: MOBILE_SPACING.xl - 2,
          paddingVertical: MOBILE_SPACING.lg,
        },
        backBtn: {
          alignSelf: 'flex-start',
          width: 'auto',
          maxWidth: 180,
          marginBottom: MOBILE_SPACING.md,
        },
        text: {
          color: t.brand,
          fontSize: MOBILE_TYPE.title,
          fontWeight: '600',
          textAlign: 'center',
        },
      }),
    [t],
  );

  return (
    <ScreenShell screen="ClientScreen">
      <View style={styles.container}>
        <NeoPanel style={styles.panel}>
          <BackNavButton onPress={() => navigation.goBack()} style={styles.backBtn} />
          <Text style={styles.text}>📈 Próximamente podrás ver tu progreso.</Text>
        </NeoPanel>
      </View>
    </ScreenShell>
  );
}
