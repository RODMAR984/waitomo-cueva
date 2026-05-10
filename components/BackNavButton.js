import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { MOBILE_RADII, MOBILE_TYPE } from '../theme/mobileSpec';

export default function BackNavButton({ onPress, label, style, testID }) {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const resolvedLabel = label || tStr('common_back');

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={resolvedLabel}
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
      <Text style={[styles.text, { color: t.text }]}>{resolvedLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    minHeight: 44,
    borderRadius: MOBILE_RADII.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: {
    fontSize: MOBILE_TYPE.body,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
