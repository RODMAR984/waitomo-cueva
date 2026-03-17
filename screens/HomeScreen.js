// HomeScreen — panel overlay y botón Admin; sin inline/literales
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

export default function HomeScreen({ navigation }) {
  const plan = { nombre: 'Inicio' };
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { alignItems: 'center', backgroundColor: t.bg, flex: 1, justifyContent: 'center' },
        panel: {
          alignItems: 'center',
          borderRadius: 20,
          padding: 30,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        title: { color: t.subText, fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
        button: { borderRadius: 10, paddingHorizontal: 30, paddingVertical: 12, ...t.buttonPrimary, elevation: 2 },
        buttonText: { ...t.buttonPrimaryText, fontSize: 16, textAlign: 'center' },
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={plan}>
      <View style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.title}>{tStr('home_title')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Admin')} style={styles.button}>
            <Text style={styles.buttonText}>{tStr('home_admin')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BackgroundWrapper>
  );
}
