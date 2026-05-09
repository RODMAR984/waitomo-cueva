// screens/ReservaScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: lista de horarios, alert de confirmación, goBack

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import BackNavButton from '../components/BackNavButton';
import getRandomGeneralImage from '../utils/getRandomGeneralImage';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../theme/webSpec';

export default function ReservaScreen({ route, navigation }) {
  const plan = route?.params?.plan ?? null;
  const fondo = route?.params?.fondo ?? (!plan ? getRandomGeneralImage() : null);

  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const [selectedId, setSelectedId] = useState(null);

  const horarios = useMemo(
    () => [
      { id: '1', diaKey: 'cal_weekday_mon', hora: '08:00' },
      { id: '2', diaKey: 'cal_weekday_tue', hora: '10:00' },
      { id: '3', diaKey: 'cal_weekday_wed', hora: '14:00' },
      { id: '4', diaKey: 'cal_weekday_thu', hora: '18:00' },
      { id: '5', diaKey: 'cal_weekday_fri', hora: '20:00' },
    ],
    [],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { backgroundColor: t.bg, flex: 1 },

        // overlay principal para contenido
        content: {
          flex: 1,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingTop: 100,
        },
        panelTitle: {
          alignSelf: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: WEB_PANEL_RADIUS,
          borderWidth: 1,
          marginBottom: 24,
          paddingHorizontal: 16,
          paddingVertical: 10,
        },
        titulo: {
          color: t.subText,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          textAlign: 'center',
        },

        lista: {
          gap: 12,
          paddingBottom: 10,
        },
        item: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: WEB_PANEL_RADIUS,
          borderWidth: 1.2,
          minHeight: MOBILE_SIZES.controlHeightLg,
          paddingHorizontal: 20,
          paddingVertical: MOBILE_SPACING.md,
          justifyContent: 'center',
        },
        itemSelected: {
          ...t.buttonPrimary,
        },
        itemText: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: 'bold',
        },
        itemTextSelected: {
          ...t.buttonPrimaryText,
        },

        // acciones
        actions: {
          alignItems: 'center',
          marginTop: 24,
        },
        confirmar: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.sm,
          minHeight: MOBILE_SIZES.controlHeight,
          paddingHorizontal: 22,
          paddingVertical: MOBILE_SPACING.md,
          justifyContent: 'center',
        },
        confirmarTxt: {
          ...t.buttonPrimaryText,
          fontWeight: 'bold',
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        volver: {
          alignItems: 'center',
          marginTop: 16,
        },
        volverTxt: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
        },
      }),
    [t],
  );

  const reservar = useCallback(
    (item) => {
      setSelectedId(item.id);
      const day = tStr(item.diaKey);
      const msg = tStr('reserva_done_body').replace('{{day}}', day).replace('{{time}}', item.hora);
      Alert.alert(tStr('reserva_done_title'), msg);
    },
    [setSelectedId, tStr],
  );

  const renderItem = ({ item }) => {
    const selected = selectedId === item.id;
    return (
      <TouchableOpacity
        onPress={() => reservar(item)}
        style={[styles.item, selected && styles.itemSelected]}
      >
        <Text style={[styles.itemText, selected && styles.itemTextSelected]}>
          {tStr(item.diaKey)} - {item.hora}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <BackgroundWrapper plan={plan} fondo={fondo}>
      <View style={styles.root}>
        <View style={styles.content}>
          <View style={styles.panelTitle}>
            <Text style={styles.titulo}>{tStr('reserva_pick_title')}</Text>
          </View>

          <FlatList
            data={horarios}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => {
                if (!selectedId) {
                  Alert.alert(tStr('reserva_pick_alert'));
                  return;
                }
                navigation.goBack();
              }}
              style={styles.confirmar}
            >
              <Text style={styles.confirmarTxt}>{tStr('reserva_confirm_back')}</Text>
            </TouchableOpacity>

            <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.volver} />
          </View>
        </View>
      </View>
    </BackgroundWrapper>
  );
}
