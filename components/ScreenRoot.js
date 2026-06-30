import React from 'react';
import { View } from 'react-native';
import { SCREEN_ROOT } from '../utils/screenLayout';

/**
 * Capa flex obligatoria entre BackgroundWrapper y el contenido de pantalla.
 * BackgroundWrapper la inserta automáticamente salvo `layoutRaw`.
 */
export default function ScreenRoot({ children, style, testID }) {
  return (
    <View style={[SCREEN_ROOT, style]} testID={testID}>
      {children}
    </View>
  );
}
