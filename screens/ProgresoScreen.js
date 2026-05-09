// screens/ProgresoScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: fondo + mensaje centrado

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import getRandomPlanImage from '../utils/getRandomPlanImage';
import { useThemeContext } from '../contexts/ThemeContext';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../theme/webSpec';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function ProgresoScreen() {
  const fondo = getRandomPlanImage('admin');
  const { t } = useThemeContext();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        background: { flex: 1 },
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          // capa sutil para asegurar legibilidad del texto
          backgroundColor: hexToRgba(t.bg, 0.0),
        },
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: WEB_PANEL_RADIUS,
          borderWidth: 1,
          paddingHorizontal: 18,
          paddingVertical: 16,
        },
        text: {
          color: t.brand,
          fontSize: 18,
          fontWeight: '600',
          textAlign: 'center',
        },
      }),
    [t],
  );

  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.text}>📈 Próximamente podrás ver tu progreso.</Text>
        </View>
      </View>
    </ImageBackground>
  );
}
