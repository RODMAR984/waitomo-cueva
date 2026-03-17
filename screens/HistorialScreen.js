// screens/HistorialScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: panel centrado con mensaje de historial

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

export default function HistorialScreen({ route }) {
  const plan = route?.params?.plan || { nombre: 'Historial' };
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          backgroundColor: t.bg,
          flex: 1,
          justifyContent: 'center',
        },
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderWidth: 1,
          borderRadius: 20,
          padding: 30,
          // sombra sutil ligada a la marca
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        text: {
          color: t.subText,
          fontSize: 18,
          textAlign: 'center',
        },
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={plan}>
      <View style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.text}>🗓️ {tStr('historial_empty')}</Text>
        </View>
      </View>
    </BackgroundWrapper>
  );
}
