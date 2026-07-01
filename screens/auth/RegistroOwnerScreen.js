// Redirige al flujo unificado de prueba 14 días (landing /signup?trial=14d y welcome).

import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TRIAL_SIGNUP_QUERY } from '../../utils/webAppLinking';

export default function RegistroOwnerScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.replace('TrialSignup', { trial: TRIAL_SIGNUP_QUERY });
  }, [navigation]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050a0d' }}>
      <ActivityIndicator color="#86C4C7" />
    </View>
  );
}
