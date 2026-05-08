// screens/SeguridadScreen.js
// Pantalla de seguridad de cuenta:
// - Cambiar contraseña (requiere contraseña actual)
// - Cambiar email (requiere contraseña actual)
// Usa AuthContext (changePassword / changeEmail) y BackgroundWrapper con fondo por plan.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import BackgroundWrapper from '../components/BackgroundWrapper';
import BackNavButton from '../components/BackNavButton';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { navigationRef } from '../navigationRef';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../theme/webSpec';

const SeguridadScreen = () => {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { profile, session, changePassword, changeEmail, deleteAccount } = useAuth();

  // ----- ESTADOS CAMBIO DE CONTRASEÑA -----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // ----- ESTADOS CAMBIO DE EMAIL -----
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);

  const currentEmail = session?.user?.email || '';

  // =========================
  //   HANDLERS
  // =========================
  
const handleChangePassword = async () => {
    console.log('=== INICIO handleChangePassword ===');
    
    if (!currentPassword || !newPassword || !repeatPassword) {
      Alert.alert(tStr('security_alert_incomplete_pass_title'), tStr('security_alert_incomplete_pass_body'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(tStr('security_alert_short_pass_title'), tStr('security_alert_short_pass_body'));
      return;
    }

    if (newPassword !== repeatPassword) {
      Alert.alert(tStr('security_alert_mismatch_title'), tStr('security_alert_mismatch_body'));
      return;
    }

    try {
      console.log('🔄 Llamando a changePassword...');
      setChangingPass(true);
      
      const result = await changePassword(currentPassword, newPassword);
      console.log('✅ changePassword retornó:', result);
      
      Alert.alert(tStr('security_success_title'), tStr('security_success_password_body'));
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      
    } catch (error) {
      console.log('❌ ERROR en handleChangePassword:', error.message);
      
      // Mensajes más amigables
      let mensaje = error.message;
      if (error.message.includes('Tiempo de espera')) {
        mensaje = tStr('security_err_timeout');
      } else if (error.message.includes('Contraseña actual incorrecta')) {
        mensaje = tStr('security_err_wrong_password');
      } else if (error.message.includes('Invalid API key')) {
        mensaje = tStr('security_err_config');
      }

      Alert.alert(tStr('security_error_title'), mensaje);
    } finally {
      console.log('🏁 FINALLY - Limpiando estado');
      setChangingPass(false);
    }
  };

  // =========================
  //   HANDLER EMAIL
  // =========================
  const handleChangeEmail = async () => {
    console.log('=== INICIO handleChangeEmail ===');
    
    if (!newEmail || !emailPassword) {
      Alert.alert(tStr('security_alert_incomplete_email_title'), tStr('security_alert_incomplete_email_body'));
      return;
    }

    if (!newEmail.includes('@')) {
      Alert.alert(tStr('security_alert_invalid_email_title'), tStr('security_alert_invalid_email_body'));
      return;
    }

    try {
      console.log('🔄 Llamando a changeEmail...');
      setChangingEmail(true);
      
      await changeEmail(newEmail, emailPassword);
      
      Alert.alert(tStr('security_success_title'), tStr('security_success_email_body'));
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      console.log('❌ ERROR en handleChangeEmail:', error.message);
      
      // Mensajes más amigables
      let mensaje = error.message;
      if (error.message.includes('Tiempo de espera')) {
        mensaje = tStr('security_err_timeout');
      } else if (error.message.includes('Contraseña actual incorrecta')) {
        mensaje = tStr('security_err_wrong_password');
      } else if (error.message.includes('already registered')) {
        mensaje = tStr('security_err_email_in_use');
      } else if (error.message.includes('confirmation')) {
        mensaje = tStr('security_err_email_confirm');
      }

      Alert.alert(tStr('security_error_title'), mensaje);
    } finally {
      console.log('🏁 FINALLY email - Limpiando estado');
      setChangingEmail(false);
    }
  };

  const resetToWelcome = () => {
    try {
      if (typeof navigationRef?.resetRoot === 'function') {
        navigationRef.resetRoot({ index: 0, routes: [{ name: 'WelcomeGlobal' }] });
        return;
      }
      const nav = navigation.getParent?.() ?? navigation;
      if (nav?.reset) {
        nav.reset({ index: 0, routes: [{ name: 'WelcomeGlobal' }] });
        return;
      }
    } catch (_) {}
    navigation.navigate('WelcomeGlobal');
  };

  const handleEliminarCuenta = () => {
    Alert.alert(
      tStr('security_delete_title'),
      tStr('security_delete_message'),
      [
        { text: tStr('common_cancel'), style: 'cancel' },
        {
          text: tStr('security_delete_confirm'),
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await deleteAccount?.();
              resetToWelcome();
            } catch (e) {
              const msg = e?.message || tStr('security_delete_fail');
              Alert.alert(tStr('gym_config_alert_title_error'), msg);
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1 },
        container: {
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 80,
          paddingBottom: 40,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        panel: {
          borderRadius: WEB_PANEL_RADIUS,
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
        sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
        sectionTitle: { fontSize: 16, fontWeight: '600', color: t.text },
        label: { fontSize: 13, color: t.subText, marginBottom: 4 },
        input: {
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 14,
          color: t.text,
          backgroundColor: t.inputBg,
          marginBottom: 10,
        },
        primaryButton: {
          marginTop: 6,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          ...t.buttonPrimary,
        },
        primaryButtonText: { ...t.buttonPrimaryText, fontWeight: '500', fontSize: 14 },
        secondaryButton: {
          marginTop: 6,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          ...t.buttonPrimary,
        },
        secondaryButtonText: { ...t.buttonPrimaryText, fontWeight: '500', fontSize: 14 },
        currentEmail: { fontSize: 12, color: t.subText, marginBottom: 8 },
        currentEmailStrong: { color: t.text, fontWeight: '500' },
        backButton: {
          marginTop: 8,
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
        deleteSection: {
          marginTop: 18,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: t.border,
        },
        deleteButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 8,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
        },
        deleteButtonText: {
          color: t.subText,
          fontWeight: '600',
          fontSize: 14,
        },
      }),
    [t],
  );

  // =========================
  //   RENDER
  // =========================
  return (
    <BackgroundWrapper plan={{ id: profile?.plan_actual }} screen="seguridad">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.panel}>
            <Text style={styles.title}>{tStr('security_screen_title')}</Text>
            <Text style={styles.subtitle}>{tStr('security_subtitle')}</Text>

            {/* ================== CAMBIO DE CONTRASEÑA ================== */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={t.text}
                />
                <Text style={styles.sectionTitle}>{tStr('security_section_password')}</Text>
              </View>

              <Text style={styles.label}>{tStr('security_label_current_password')}</Text>
              <PasswordInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder={tStr('security_ph_current_password')}
                placeholderTextColor={t.placeholder}
                containerStyle={{ marginBottom: 12 }}
              />

              <Text style={styles.label}>{tStr('security_label_new_password')}</Text>
              <PasswordInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={tStr('security_ph_new_password')}
                placeholderTextColor={t.placeholder}
                containerStyle={{ marginBottom: 12 }}
              />

              <Text style={styles.label}>{tStr('security_label_repeat_password')}</Text>
              <PasswordInput
                style={styles.input}
                value={repeatPassword}
                onChangeText={setRepeatPassword}
                placeholder={tStr('security_ph_repeat_password')}
                placeholderTextColor={t.placeholder}
                containerStyle={{ marginBottom: 12 }}
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleChangePassword}
                disabled={changingPass}
              >
                <Text style={styles.primaryButtonText}>
                  {changingPass ? tStr('security_btn_updating') : tStr('security_btn_update_password')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ================== CAMBIO DE EMAIL ================== */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={t.text}
                />
                <Text style={styles.sectionTitle}>{tStr('security_section_email')}</Text>
              </View>

              <Text style={styles.currentEmail}>
                {tStr('security_current_email_label')}{' '}
                <Text style={styles.currentEmailStrong}>
                  {currentEmail || '—'}
                </Text>
              </Text>

              <Text style={styles.label}>{tStr('security_label_new_email')}</Text>
              <TextInput
                style={styles.input}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder={tStr('security_ph_new_email')}
                placeholderTextColor={t.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>{tStr('security_label_current_password')}</Text>
              <PasswordInput
                style={styles.input}
                value={emailPassword}
                onChangeText={setEmailPassword}
                placeholder={tStr('security_ph_current_password')}
                placeholderTextColor={t.placeholder}
                containerStyle={{ marginBottom: 12 }}
              />

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleChangeEmail}
                disabled={changingEmail}
              >
                <Text style={styles.secondaryButtonText}>
                  {changingEmail ? tStr('security_btn_updating') : tStr('security_btn_update_email')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ================== ELIMINAR CUENTA ================== */}
            <View style={styles.deleteSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trash-outline" size={18} color={t.text} />
                <Text style={styles.sectionTitle}>{tStr('security_section_delete')}</Text>
              </View>
              <Text style={[styles.subtitle, { marginBottom: 8 }]}>{tStr('security_delete_hint')}</Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleEliminarCuenta}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color={t.subText} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={t.subText} />
                )}
                <Text style={styles.deleteButtonText}>
                  {deletingAccount ? tStr('security_deleting') : tStr('security_btn_delete_account')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* VOLVER */}
            <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backButton} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
};

export default SeguridadScreen;
