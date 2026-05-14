// WelcomeScreen — Punto de compatibilidad: todo el arranque vive en WelcomeGlobal.
// Si alguien aterriza aquí (ruta histórica / fallback), se redirige al inicio global o al destino según sesión.

import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { fitengineLogoColors as fe, fitengineUiTokens as fitT } from '../../theme/colors';
import LogoCompleto from '../../components/LogoCompleto';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { session, loading, profile, role, isPlatformAdmin } = useAuth() || {};
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    if (loading) return;

    if (!session?.user?.id) {
      doneRef.current = true;
      navigation.replace('WelcomeGlobal');
      return;
    }

    if (!profile?.id) {
      doneRef.current = true;
      navigation.replace('RegistroInicial', { plan: null, abono: null });
      return;
    }

    const platformOk =
      role === 'superadmin' || (typeof isPlatformAdmin === 'function' && isPlatformAdmin());
    if (platformOk) {
      doneRef.current = true;
      navigation.replace('Superadmin');
      return;
    }
    if (role === 'coach') {
      doneRef.current = true;
      navigation.replace('AdminLite');
      return;
    }
    doneRef.current = true;
    navigation.replace('ClientTabs');
  }, [loading, session?.user?.id, profile?.id, role, navigation, isPlatformAdmin]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: fe.background,
        padding: 24,
      }}
    >
      <LogoCompleto height={100} />
      <ActivityIndicator size="large" color={fitT.logoCian} style={{ marginTop: 24 }} />
    </View>
  );
}
