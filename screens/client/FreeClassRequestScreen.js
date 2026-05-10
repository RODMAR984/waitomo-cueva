// screens/FreeClassRequestScreen.js — Waitomo Dark Only refactor
// - Solo colors.dark como base (sin ThemeContext, sin isDark)
// - Sin colores literales ni estilos inline
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos con useMemo + StyleSheet.create
// - Funcionalidad preservada: validar, confirmar, alerts y navegación

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import BackgroundWrapper from '../../components/BackgroundWrapper';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatYmdLocal } from '../../utils/formatYmdLocal';
import { normalizePlanKey } from '../../utils/planKeyNormalize';
import { clearFreeClassGrant, saveFreeClassGrant } from '../../utils/freeClassGrantStorage';
import { insertTrialClassGrantServer } from '../../services/booking/trialClassGrant';
import { FREE_CLASS_CANCEL_NOTICE_HOURS } from '../../utils/freeClassPolicy';
import BackNavButton from '../../components/BackNavButton';
import NeoPanel from '../../components/NeoPanel';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function FreeClassRequestScreen({ route, navigation }) {
  const defaultPlan = { nombre: 'Clase Gratuita' };
  const { plan = defaultPlan } = route?.params || {};
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const { organization, profile, user } = useAuth() || {};

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [selectedHour, setSelectedHour] = useState(null);
  const [sessionDate, setSessionDate] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  const hours = useMemo(
    () => Array.from({ length: 13 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`),
    [],
  );

  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const sessionYmd = useMemo(() => formatYmdLocal(sessionDate), [sessionDate]);

  const handleRequest = async () => {
    if (!name.trim() || !contact.trim() || !selectedHour) {
      Alert.alert(tStr('freeclass_alert_missing_title'), tStr('freeclass_alert_missing_body'));
      return;
    }

    const todayYmd = formatYmdLocal(new Date());
    if (!sessionYmd || sessionYmd < todayYmd) {
      Alert.alert(tStr('freeclass_alert_date_title'), tStr('freeclass_alert_date_body'));
      return;
    }

    const planCanon =
      normalizePlanKey(plan?.id || plan?.code || plan?.planKey || plan?.nombre) || 'cross';
    const orgId = organization?.id || profile?.organization_id || null;
    await saveFreeClassGrant({
      planCanonId: planCanon,
      fechaYmd: sessionYmd,
      slotLabel: selectedHour,
      organizationId: orgId,
    });

    if (user?.id && orgId) {
      const note = `${name.trim()} — ${contact.trim()}`;
      const serverRes = await insertTrialClassGrantServer({
        userId: user.id,
        organizationId: orgId,
        planCanonId: planCanon,
        fechaYmd: sessionYmd,
        slotLabel: selectedHour,
        contactNote: note,
      });
      if (!serverRes.ok) {
        await clearFreeClassGrant();
        // eslint-disable-next-line no-console
        console.warn('trial_class_grants book', serverRes.error?.message || serverRes.reason);
        Alert.alert(tStr('freeclass_book_error_title'), tStr('freeclass_book_error_body'));
        return;
      }
    }

    const loc = locale === 'en' ? 'en-US' : 'es-AR';
    const dateLabel = sessionDate.toLocaleDateString(loc, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const hStr = String(FREE_CLASS_CANCEL_NOTICE_HOURS);
    const body = tStr('freeclass_success_body')
      .replace('{{hour}}', selectedHour)
      .replace('{{date}}', dateLabel)
      .replace(/\{\{hours\}\}/g, hStr);
    Alert.alert(tStr('freeclass_success_title'), body);

    navigation.goBack();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cancel: {
          alignItems: 'center',
          marginTop: MOBILE_SPACING.md,
        },
        cancelText: {
          color: t.text,
          fontSize: MOBILE_TYPE.body,
        },
        confirmButton: {
          alignItems: 'center',
          justifyContent: 'center',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.sm,
          minHeight: MOBILE_SIZES.controlHeightLg,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
        },
        confirmText: {
          ...t.buttonPrimaryText,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: 'bold',
        },
        hourButton: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          margin: MOBILE_SPACING.xs,
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingVertical: MOBILE_SPACING.sm + 2,
          minHeight: MOBILE_SIZES.controlHeight,
          justifyContent: 'center',
        },
        hourButtonSelected: {
          ...t.buttonPrimary,
        },
        hourGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: MOBILE_SPACING.sm + 2,
          justifyContent: 'center',
          marginBottom: MOBILE_SPACING.xl,
        },
        fieldLabel: {
          color: t.subText ?? t.placeholder,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          marginBottom: MOBILE_SPACING.sm,
          textAlign: 'left',
          width: '100%',
        },
        hourText: {
          color: t.text,
          fontWeight: 'normal',
          fontSize: MOBILE_TYPE.body,
        },
        hourTextSelected: {
          ...t.buttonPrimaryText,
          fontWeight: 'bold',
        },
        input: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          minHeight: MOBILE_SIZES.controlHeight,
          marginBottom: MOBILE_SPACING.xl - 2,
          paddingHorizontal: MOBILE_SPACING.md + 3,
        },
        kav: {
          flex: 1,
        },
        panel: {
          borderRadius: MOBILE_RADII.lg,
          padding: MOBILE_SPACING.xxl,
          marginHorizontal: MOBILE_SPACING.sm + 2,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          backgroundColor: t.boxBg,
        },
        scroll: {
          backgroundColor: 'transparent',
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 60,
        },
        title: {
          color: t.subText,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: MOBILE_SPACING.xxl,
          textAlign: 'center',
        },
        datePicker: {
          width: '100%',
        },
        policyHint: {
          color: t.placeholder,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 18,
          marginTop: MOBILE_SPACING.sm,
          marginBottom: MOBILE_SPACING.sm,
          textAlign: 'center',
        },
        backWrap: { marginTop: MOBILE_SPACING.sm + 2, alignItems: 'center' },
      }),
    [t],
  );

  const hoursNotice = String(FREE_CLASS_CANCEL_NOTICE_HOURS);

  return (
    <BackgroundWrapper screen="ClientScreen" plan={plan}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: 'transparent' }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <NeoPanel style={styles.panel}>
            <Text style={styles.title}>{tStr('freeclass_screen_title')}</Text>

            <TextInput
              style={styles.input}
              placeholder={tStr('freeclass_ph_name')}
              placeholderTextColor={t.placeholder}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={styles.input}
              placeholder={tStr('freeclass_ph_contact')}
              placeholderTextColor={t.placeholder}
              value={contact}
              onChangeText={setContact}
              keyboardType="default"
            />

            <Text style={styles.fieldLabel}>{tStr('freeclass_pick_date_title')}</Text>
            {Platform.OS === 'android' ? (
              <>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => setAndroidPickerOpen(true)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.confirmText}>{sessionYmd}</Text>
                </TouchableOpacity>
                {androidPickerOpen ? (
                  <DateTimePicker
                    value={sessionDate}
                    mode="date"
                    display="calendar"
                    minimumDate={minDate}
                    onChange={(_, date) => {
                      setAndroidPickerOpen(false);
                      if (date) {
                        const d = new Date(date);
                        d.setHours(12, 0, 0, 0);
                        setSessionDate(d);
                      }
                    }}
                  />
                ) : null}
              </>
            ) : (
              <DateTimePicker
                value={sessionDate}
                mode="date"
                display="spinner"
                minimumDate={minDate}
                onChange={(_, date) => {
                  if (!date) return;
                  const d = new Date(date);
                  d.setHours(12, 0, 0, 0);
                  setSessionDate(d);
                }}
                style={styles.datePicker}
              />
            )}
            <Text style={[styles.fieldLabel, { marginTop: 10, fontWeight: '600' }]}>
              {tStr('freeclass_pick_date_hint').replace(/\{\{hours\}\}/g, hoursNotice)}
            </Text>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{tStr('freeclass_title')}</Text>

            <View style={styles.hourGrid}>
              {hours.map((h) => {
                const selected = selectedHour === h;
                return (
                  <TouchableOpacity
                    key={h}
                    onPress={() => setSelectedHour(h)}
                    style={[styles.hourButton, selected && styles.hourButtonSelected]}
                  >
                    <Text style={[styles.hourText, selected && styles.hourTextSelected]}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.policyHint}>
              {tStr('freeclass_policy_footer').replace(/\{\{hours\}\}/g, hoursNotice)}
            </Text>

            <TouchableOpacity onPress={handleRequest} style={styles.confirmButton}>
              <Text style={styles.confirmText}>{tStr('freeclass_confirm')}</Text>
            </TouchableOpacity>
            <View style={styles.backWrap}>
              <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} />
            </View>

            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancel}>
              <Text style={styles.cancelText}>{tStr('freeclass_cancel')}</Text>
            </TouchableOpacity>
          </NeoPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
