import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { MOBILE_RADII, MOBILE_TYPE } from '../theme/mobileSpec';

/**
 * Volver compacto (chevron + texto), no barra a ancho completo tipo encabezado.
 * Estilos extra vía `style` (p. ej. margin) se fusionan al final.
 */
export default function BackNavButton({ onPress, label, style, testID }) {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const resolvedLabel = label || tStr('common_back');

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={resolvedLabel}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.72 : 1 },
        style,
      ]}
    >
      <Ionicons name="chevron-back" size={20} color={t.text} style={styles.icon} />
      <Text style={[styles.text, { color: t.text }]} numberOfLines={1}>
        {resolvedLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 1,
    paddingVertical: 6,
    paddingRight: 8,
    paddingLeft: 2,
    borderRadius: MOBILE_RADII.md,
    backgroundColor: 'transparent',
  },
  icon: {
    marginRight: 2,
  },
  text: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
});
