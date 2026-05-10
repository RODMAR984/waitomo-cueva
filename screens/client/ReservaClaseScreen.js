// screens/ReservaClaseScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: selección de hora, alert y navegación a TrabajoDelDiaScreen

import React, { useMemo, useState } from 'react';
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import NeoPanel from '../../components/NeoPanel';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING } from '../../theme/mobileSpec';

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
          borderRadius: MOBILE_RADII.md,
          marginBottom: 10,
          padding: 14,
        },
        confirmarTxt: t.buttonPrimaryText,
        horaBtn: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          margin: 5,
          paddingHorizontal: MOBILE_SPACING.xl,
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
          borderRadius: WEB_PANEL_RADIUS,
          padding: MOBILE_SPACING.xxl,
          backgroundColor: t.boxBg,
        },
        scroll: {
          backgroundColor: 'transparent',
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 40,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
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
      <ScrollView style={{ flex: 1, backgroundColor: 'transparent' }} contentContainerStyle={styles.scroll}>
        <NeoPanel style={styles.panel}>
          <BackNavButton onPress={() => navigation.goBack()} />
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

          {Platform.OS !== 'web' ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelar}>
              <Text style={styles.cancelarTxt}>{tStr('reserva_clase_cancel')}</Text>
            </TouchableOpacity>
          ) : null}
        </NeoPanel>
      </ScrollView>
    </BackgroundWrapper>
  );
}
