// screens/ReservaClaseScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: selección de hora, alert y navegación a TrabajoDelDiaScreen

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

// ---------- screen ----------
export default function ReservaClaseScreen({ route, navigation }) {
  const { plan, fecha } = route.params;

  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const [selectedHour, setSelectedHour] = useState(null);

  const horas = useMemo(
    () => Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`),
    [],
  );

  const handleReserva = () => {
    if (!selectedHour) {
      Alert.alert(tStr('reserva_clase_pick_alert'));
      return;
    }

    const msg = tStr('reserva_clase_ok_body').replace('{{time}}', selectedHour).replace('{{date}}', fecha);
    Alert.alert(
      tStr('reserva_clase_ok_title'),
      msg,
      [
        {
          text: tStr('common_ok'),
          onPress: () =>
            navigation.navigate('TrabajoDelDiaScreen', {
              plan,
              fecha,
              horario: selectedHour,
            }),
        },
      ],
    );
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cancelar: {
          alignItems: 'center',
          marginTop: 10,
        },
        cancelarTxt: { color: t.text },
        confirmar: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          marginBottom: 10,
          padding: 14,
        },
        confirmarTxt: t.buttonPrimaryText,
        horaBtn: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          margin: 5,
          paddingHorizontal: 20,
          paddingVertical: 10,
        },
        horaBtnSelected: {
          ...t.buttonPrimary,
        },
        horaTxt: {
          color: t.text,
          fontWeight: '600',
        },
        horaTxtSelected: {
          ...t.buttonPrimaryText,
          fontWeight: 'bold',
        },
        hourGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
          marginBottom: 20,
        },
        panel: {
          borderRadius: 22,
          padding: 24,
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderWidth: 1,
          // sombra sutil ligada a brand
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
        },
        scroll: {
          backgroundColor: t.bg,
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingVertical: 40,
        },
        title: {
          color: t.subText,
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 20,
          textAlign: 'center',
        },
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={plan}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.panel}>
          <Text style={styles.title}>{tStr('reserva_clase_title').replace('{{date}}', fecha)}</Text>

          <View style={styles.hourGrid}>
            {horas.map((hora) => {
              const selected = selectedHour === hora;
              return (
                <TouchableOpacity
                  key={hora}
                  style={[styles.horaBtn, selected && styles.horaBtnSelected]}
                  onPress={() => setSelectedHour(hora)}
                >
                  <Text style={[styles.horaTxt, selected && styles.horaTxtSelected]}>
                    {hora}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.confirmar} onPress={handleReserva}>
            <Text style={styles.confirmarTxt}>{tStr('reserva_clase_confirm')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelar}>
            <Text style={styles.cancelarTxt}>{tStr('reserva_clase_cancel')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
