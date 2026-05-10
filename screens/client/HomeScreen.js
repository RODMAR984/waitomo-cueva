// HomeScreen — panel overlay y botón Admin; sin inline/literales
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BackgroundWrapper from '../../components/BackgroundWrapper';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';

export default function HomeScreen({ navigation }) {
  const plan = { nombre: 'Inicio' };
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
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          paddingHorizontal: MOBILE_SPACING.lg,
        },
        panel: {
          alignItems: 'center',
          borderRadius: MOBILE_RADII.lg,
          padding: 30,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        title: { color: t.subText, fontSize: MOBILE_TYPE.title, fontWeight: 'bold', marginBottom: MOBILE_SPACING.xl, textAlign: 'center' },
        button: {
          borderRadius: MOBILE_RADII.sm,
          minHeight: MOBILE_SIZES.controlHeightLg,
          paddingHorizontal: 30,
          paddingVertical: MOBILE_SPACING.md,
          ...t.buttonPrimary,
          elevation: 2,
        },
        buttonText: { ...t.buttonPrimaryText, fontSize: MOBILE_TYPE.bodyStrong, textAlign: 'center' },
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={plan}>
      <View style={styles.container}>
        <NeoPanel style={styles.panel}>
          <Text style={styles.title}>{tStr('home_title')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Admin')} style={styles.button}>
            <Text style={styles.buttonText}>{tStr('home_admin')}</Text>
          </TouchableOpacity>
        </NeoPanel>
      </View>
    </BackgroundWrapper>
  );
}
