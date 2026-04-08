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
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { navigationRef } from '../navigationRef';

const SeguridadScreen = () => {
  const navigation = useNavigation();
  const { t } = useThemeContext();
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
      Alert.alert('Datos incompletos', 'Completá todos los campos de contraseña.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(
        'Contraseña corta',
        'La nueva contraseña debe tener al menos 6 caracteres.',
      );
      return;
    }

    if (newPassword !== repeatPassword) {
      Alert.alert(
        'No coinciden',
        'La nueva contraseña y su repetición no coinciden.',
      );
      return;
    }

    try {
      console.log('🔄 Llamando a changePassword...');
      setChangingPass(true);
      
      const result = await changePassword(currentPassword, newPassword);
      console.log('✅ changePassword retornó:', result);
      
      Alert.alert('✅ ¡Listo!', 'Tu contraseña fue actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      
    } catch (error) {
      console.log('❌ ERROR en handleChangePassword:', error.message);
      
      // Mensajes más amigables
      let mensaje = error.message;
      if (error.message.includes('Tiempo de espera')) {
        mensaje = 'El servidor tardó demasiado en responder. Intentá de nuevo.';
      } else if (error.message.includes('Contraseña actual incorrecta')) {
        mensaje = 'La contraseña actual es incorrecta.';
      } else if (error.message.includes('Invalid API key')) {
        mensaje = 'Error de configuración. Contactá al administrador.';
      }
      
      Alert.alert('❌ Error', mensaje);
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
      Alert.alert(
        'Datos incompletos',
        'Completá el nuevo email y tu contraseña actual.',
      );
      return;
    }

    if (!newEmail.includes('@')) {
      Alert.alert('Email inválido', 'Ingresá un email válido.');
      return;
    }

    try {
      console.log('🔄 Llamando a changeEmail...');
      setChangingEmail(true);
      
      await changeEmail(newEmail, emailPassword);
      
      Alert.alert('✅ ¡Listo!', 'Tu email de acceso fue actualizado.');
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      console.log('❌ ERROR en handleChangeEmail:', error.message);
      
      // Mensajes más amigables
      let mensaje = error.message;
      if (error.message.includes('Tiempo de espera')) {
        mensaje = 'El servidor tardó demasiado en responder. Intentá de nuevo.';
      } else if (error.message.includes('Contraseña actual incorrecta')) {
        mensaje = 'La contraseña actual es incorrecta.';
      } else if (error.message.includes('already registered')) {
        mensaje = 'Este email ya está en uso por otro usuario.';
      } else if (error.message.includes('confirmation')) {
        mensaje = 'Revisá tu bandeja de entrada para confirmar el nuevo email.';
      }
      
      Alert.alert('❌ Error', mensaje);
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
      'Eliminar cuenta',
      'Se borrarán todos tus datos (perfil, planes, historial) y no podrás volver a entrar con esta cuenta. ¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar mi cuenta',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await deleteAccount?.();
              resetToWelcome();
            } catch (e) {
              const msg = e?.message || 'No se pudo eliminar la cuenta. Probá de nuevo o contactá soporte.';
              Alert.alert('Error', msg);
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
            <Text style={styles.title}>Seguridad de la cuenta</Text>
            <Text style={styles.subtitle}>
              Desde acá podés cambiar tu contraseña y tu email de acceso.
            </Text>

            {/* ================== CAMBIO DE CONTRASEÑA ================== */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={t.text}
                />
                <Text style={styles.sectionTitle}>Cambiar contraseña</Text>
              </View>

              <Text style={styles.label}>Contraseña actual</Text>
              <PasswordInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Tu contraseña actual"
                placeholderTextColor={t.placeholder}
                containerStyle={{ marginBottom: 12 }}
              />

              <Text style={styles.label}>Nueva contraseña</Text>
              <PasswordInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Nueva contraseña"
                placeholderTextColor={t.placeholder}
                containerStyle={{ marginBottom: 12 }}
              />

              <Text style={styles.label}>Repetir nueva contraseña</Text>
              <PasswordInput
                style={styles.input}
                value={repeatPassword}
                onChangeText={setRepeatPassword}
                placeholder="Repetí la nueva contraseña"
                placeholderTextColor={t.placeholder}
                containerStyle={{ marginBottom: 12 }}
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleChangePassword}
                disabled={changingPass}
              >
                <Text style={styles.primaryButtonText}>
                  {changingPass ? 'Actualizando...' : 'Actualizar contraseña'}
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
                <Text style={styles.sectionTitle}>Cambiar email de acceso</Text>
              </View>

              <Text style={styles.currentEmail}>
                Email actual:{' '}
                <Text style={styles.currentEmailStrong}>
                  {currentEmail || '—'}
                </Text>
              </Text>

              <Text style={styles.label}>Nuevo email</Text>
              <TextInput
                style={styles.input}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="Nuevo email"
                placeholderTextColor={t.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Contraseña actual</Text>
              <PasswordInput
                style={styles.input}
                value={emailPassword}
                onChangeText={setEmailPassword}
                placeholder="Tu contraseña actual"
                placeholderTextColor={t.placeholder}
                containerStyle={{ marginBottom: 12 }}
              />

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleChangeEmail}
                disabled={changingEmail}
              >
                <Text style={styles.secondaryButtonText}>
                  {changingEmail ? 'Actualizando...' : 'Actualizar email'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ================== ELIMINAR CUENTA ================== */}
            <View style={styles.deleteSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trash-outline" size={18} color={t.text} />
                <Text style={styles.sectionTitle}>Eliminar cuenta</Text>
              </View>
              <Text style={[styles.subtitle, { marginBottom: 8 }]}>
                Se borrarán todos tus datos y no podrás volver a entrar con esta cuenta.
              </Text>
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
                  {deletingAccount ? 'Eliminando...' : 'Eliminar mi cuenta'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* VOLVER */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons
                name="arrow-back"
                size={18}
                color={t.primaryText}
              />
              <Text style={styles.backButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
};

export default SeguridadScreen;
