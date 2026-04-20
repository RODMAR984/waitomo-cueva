// SplashScreen — Logo completo (triangulo + texto). Fondo #050a0d.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { fitengineLogoColors as fe } from '../theme/colors';
import LogoCompleto from '../components/LogoCompleto';
import { useLocale } from '../contexts/LocaleContext';

const SPLASH_DURATION_MS = 1600;

export default function SplashScreen() {
  const navigation = useNavigation();
  const { t: tStr } = useLocale();
  const goneRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (goneRef.current) return;
      goneRef.current = true;
      navigation.replace('WelcomeGlobal');
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  const goToWelcome = () => {
    if (goneRef.current) return;
    goneRef.current = true;
    navigation.replace('WelcomeGlobal');
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={goToWelcome}
      style={[styles.container, { backgroundColor: fe.background }]}
    >
      <View style={styles.center}>
        <LogoCompleto height={155} style={styles.logo} />
        <Text style={[styles.byWaitomo, { color: fe.subText }]}>{tStr('splash_by_waitomo')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
  },
  logo: {
    marginBottom: 4,
  },
  fitEngine: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  byWaitomo: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    letterSpacing: 1,
    opacity: 0.9,
  },
});
