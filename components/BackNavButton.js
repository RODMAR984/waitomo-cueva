import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

export default function BackNavButton({ onPress, label, style }) {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        styles.button,
        {
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: t.text }]}>{label || tStr('common_back')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
