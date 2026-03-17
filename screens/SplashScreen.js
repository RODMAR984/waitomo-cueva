// SplashScreen — Brand & Logo spec: plataforma = FitEngine (grande) + by WAITOMO (más pequeño).
// Se muestra al abrir la app y pasa a Welcome tras un breve delay o al tocar.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getThemeTokens } from '../theme/colors';

const SPLASH_DURATION_MS = 2200;

export default function SplashScreen() {
  const navigation = useNavigation();
  const t = getThemeTokens('dark');
  const goneRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (goneRef.current) return;
      goneRef.current = true;
      navigation.replace('Welcome');
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  const goToWelcome = () => {
    if (goneRef.current) return;
    goneRef.current = true;
    navigation.replace('Welcome');
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={goToWelcome} style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.center}>
        <Text style={[styles.fitEngine, { color: t.text }]}>FitEngine</Text>
        <Text style={[styles.byWaitomo, { color: t.subText }]}>by WAITOMO</Text>
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
