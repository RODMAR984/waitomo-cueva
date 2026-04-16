// screens/ConfigScreen.js — Configuración (acceso desde Perfil)
// - Idioma: Español | English
// - Apariencia: Oscuro | Claro | Automático (por defecto oscuro)
// - Notificaciones: toggles por tipo (mensajes, trabajo del día, novedades, avisos plan/pago)
// - Persiste en Supabase (profiles: theme_mode, notif_*); idioma en AsyncStorage (+ profile.locale si existe)

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { LOCALE_ES, LOCALE_EN } from '../contexts/LocaleContext';

const MODES = [
  { key: 'dark', labelKey: 'config_dark', icon: 'moon' },
  { key: 'light', labelKey: 'config_light', icon: 'sunny' },
  { key: 'auto', labelKey: 'config_auto', icon: 'phone-portrait-outline' },
];

const ConfigScreen = () => {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { t: tStr, locale, setLocale } = useLocale();
  const { profile, updateProfile } = useAuth();
  const { mode, setMode } = useThemeContext();

  const themeMode = profile?.theme_mode ?? mode ?? 'dark';

  // Sincronizar tema desde Supabase al abrir (por si cambió en otro dispositivo)
  React.useEffect(() => {
    const fromProfile = profile?.theme_mode;
    if (fromProfile && (fromProfile === 'light' || fromProfile === 'dark' || fromProfile === 'auto') && fromProfile !== mode) {
      setMode(fromProfile);
    }
  }, [profile?.theme_mode]);

  // Sincronizar idioma desde Supabase al abrir (si existe profile.locale)
  React.useEffect(() => {
    const fromProfile = profile?.locale;
    if (fromProfile === LOCALE_ES || fromProfile === LOCALE_EN) setLocale(fromProfile);
  }, [profile?.locale]);

  const handleModePress = useCallback(
    async (key) => {
      if (key === themeMode) return;
      setMode(key);
      try {
        await updateProfile({ theme_mode: key });
      } catch (e) {
        console.warn('Config: no se pudo guardar theme_mode en Supabase', e?.message);
      }
    },
    [themeMode, setMode, updateProfile],
  );

  const handleLocalePress = useCallback(
    async (newLocale) => {
      if (newLocale === locale) return;
      setLocale(newLocale);
      try {
        await updateProfile({ locale: newLocale });
      } catch (e) {
        console.warn('Config: no se pudo guardar locale en Supabase', e?.message);
      }
    },
    [locale, setLocale, updateProfile],
  );

  const notif = useMemo(
    () => ({
      messages: profile?.notif_messages !== false,
      trabajo_dia: profile?.notif_trabajo_dia !== false,
      novedades: profile?.notif_novedades !== false,
      plan_pago: profile?.notif_plan_pago !== false,
    }),
    [
      profile?.notif_messages,
      profile?.notif_trabajo_dia,
      profile?.notif_novedades,
      profile?.notif_plan_pago,
    ],
  );

  const [savingNotif, setSavingNotif] = React.useState(null);
  const handleNotifToggle = useCallback(
    async (key, value) => {
      const col = `notif_${key}`;
      setSavingNotif(col);
      try {
        await updateProfile({ [col]: value });
      } catch (e) {
        console.warn('Config: no se pudo guardar notif en Supabase', e?.message);
      } finally {
        setSavingNotif(null);
      }
    },
    [updateProfile],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1 },
        container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 },
        panel: {
          borderRadius: 20,
          padding: 18,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        title: { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 6 },
        subtitle: { fontSize: 13, color: t.subText, marginBottom: 18 },
        section: {
          marginTop: 10,
          marginBottom: 14,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: t.border,
        },
        sectionFirst: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
        sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
        sectionTitle: { fontSize: 16, fontWeight: '600', color: t.text, letterSpacing: 0.5, textTransform: 'uppercase' },
        modeRow: {
          flexDirection: 'row',
          gap: 10,
          marginBottom: 8,
        },
        modeBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
        },
        modeBtnActive: {},
        modeBtnText: { fontSize: 14, fontWeight: '500', color: t.text },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: t.overlayBorder,
        },
        rowLast: { borderBottomWidth: 0 },
        rowLabel: { fontSize: 14, color: t.text, flex: 1 },
        rowHint: { fontSize: 12, color: t.subText, marginTop: 2 },
        backButton: {
          marginTop: 16,
          alignSelf: 'center',
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          ...t.buttonPrimary,
        },
        backButtonText: { ...t.buttonPrimaryText, fontSize: 14 },
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={{ id: profile?.plan_actual }} screen="config">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.title}>{tStr('config_title')}</Text>
          <Text style={styles.subtitle}>{tStr('config_subtitle')}</Text>

          {/* Idioma */}
          <View style={[styles.section, styles.sectionFirst]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="language-outline" size={18} color={t.text} />
              <Text style={styles.sectionTitle}>{tStr('config_language')}</Text>
            </View>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  locale === LOCALE_ES
                    ? { ...t.buttonPrimary, borderWidth: 2, borderColor: t.borderStrong ?? t.brand }
                    : { backgroundColor: t.segmentInactiveBg ?? t.faintStrong, borderColor: t.overlayBorder, borderWidth: 1 },
                ]}
                onPress={() => handleLocalePress(LOCALE_ES)}
                activeOpacity={0.9}
              >
                <Text style={[styles.modeBtnText, { color: locale === LOCALE_ES ? (t.primaryText ?? '#f4ffff') : (t.segmentInactiveText ?? t.text) }]}>
                  {tStr('config_spanish')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  locale === LOCALE_EN
                    ? { ...t.buttonPrimary, borderWidth: 2, borderColor: t.borderStrong ?? t.brand }
                    : { backgroundColor: t.segmentInactiveBg ?? t.faintStrong, borderColor: t.overlayBorder, borderWidth: 1 },
                ]}
                onPress={() => handleLocalePress(LOCALE_EN)}
                activeOpacity={0.9}
              >
                <Text style={[styles.modeBtnText, { color: locale === LOCALE_EN ? (t.primaryText ?? '#f4ffff') : (t.segmentInactiveText ?? t.text) }]}>
                  {tStr('config_english')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Apariencia */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="color-palette-outline" size={18} color={t.text} />
              <Text style={styles.sectionTitle}>{tStr('config_appearance')}</Text>
            </View>
            <View style={styles.modeRow}>
              {MODES.map((m) => {
                const isActive = themeMode === m.key;
                const btnStyle = isActive
                  ? { ...t.buttonPrimary, borderWidth: 2, borderColor: t.borderStrong ?? t.brand }
                  : { backgroundColor: t.segmentInactiveBg ?? t.faintStrong, borderColor: t.overlayBorder, borderWidth: 1 };
                const textColor = isActive ? (t.primaryText ?? '#f4ffff') : (t.segmentInactiveText ?? t.text);
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.modeBtn, btnStyle]}
                    onPress={() => handleModePress(m.key)}
                    activeOpacity={0.9}
                  >
                    <Ionicons name={m.icon} size={18} color={textColor} />
                    <Text style={[styles.modeBtnText, { color: textColor }]}>{tStr(m.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.rowHint}>{tStr('config_defaultThemeHint')}</Text>
          </View>

          {/* Notificaciones */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications-outline" size={18} color={t.text} />
              <Text style={styles.sectionTitle}>{tStr('config_notifications')}</Text>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{tStr('config_notif_messages')}</Text>
                <Text style={styles.rowHint}>{tStr('config_notif_messages_hint')}</Text>
              </View>
              {savingNotif === 'notif_messages' ? (
                <ActivityIndicator size="small" color={t.text} />
              ) : (
                <Switch
                  value={notif.messages}
                  onValueChange={(v) => handleNotifToggle('messages', v)}
                  trackColor={{ false: t.overlayBorder, true: t.brand?.primary ?? '#00ffff' }}
                  thumbColor="#f4ffff"
                />
              )}
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{tStr('config_notif_trabajo_dia')}</Text>
                <Text style={styles.rowHint}>{tStr('config_notif_trabajo_dia_hint')}</Text>
              </View>
              {savingNotif === 'notif_trabajo_dia' ? (
                <ActivityIndicator size="small" color={t.text} />
              ) : (
                <Switch
                  value={notif.trabajo_dia}
                  onValueChange={(v) => handleNotifToggle('trabajo_dia', v)}
                  trackColor={{ false: t.overlayBorder, true: t.brand?.primary ?? '#00ffff' }}
                  thumbColor="#f4ffff"
                />
              )}
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{tStr('config_notif_novedades')}</Text>
                <Text style={styles.rowHint}>{tStr('config_notif_novedades_hint')}</Text>
              </View>
              {savingNotif === 'notif_novedades' ? (
                <ActivityIndicator size="small" color={t.text} />
              ) : (
                <Switch
                  value={notif.novedades}
                  onValueChange={(v) => handleNotifToggle('novedades', v)}
                  trackColor={{ false: t.overlayBorder, true: t.brand?.primary ?? '#00ffff' }}
                  thumbColor="#f4ffff"
                />
              )}
            </View>
            <View style={[styles.row, styles.rowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{tStr('config_notif_plan_pago')}</Text>
                <Text style={styles.rowHint}>{tStr('config_notif_plan_pago_hint')}</Text>
              </View>
              {savingNotif === 'notif_plan_pago' ? (
                <ActivityIndicator size="small" color={t.text} />
              ) : (
                <Switch
                  value={notif.plan_pago}
                  onValueChange={(v) => handleNotifToggle('plan_pago', v)}
                  trackColor={{ false: t.overlayBorder, true: t.brand?.primary ?? '#00ffff' }}
                  thumbColor="#f4ffff"
                />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle-outline" size={18} color={t.text} />
              <Text style={styles.sectionTitle}>{tStr('config_section_app')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.row, styles.rowLast, { borderBottomWidth: 0 }]}
              onPress={() => navigation.navigate('AboutFitEngine')}
              activeOpacity={0.85}
            >
              <Text style={styles.rowLabel}>{tStr('config_about_link')}</Text>
              <Ionicons name="chevron-forward" size={20} color={t.subText} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.9}>
            <Ionicons name="arrow-back" size={18} color={t.primaryText} />
            <Text style={styles.backButtonText}>{tStr('config_back')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
};

export default ConfigScreen;
