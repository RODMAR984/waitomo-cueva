// screens/PerfilUsuarioScreen.js — Waitomo Perfil + Fondo tipo ClientScreen
// - Usa perfil real desde AuthContext (Supabase)
// - Edita: nombre, usuario, teléfono, edad, peso, objetivos, lesiones, sexo, observaciones
// - Muestra / usa avatar_url si existe
// - Fondo visual: BackgroundWrapper con screen="ClientScreen" (igual familia que ClientScreen)
// - Botones extra: Cerrar sesión + Volver + Seguridad (email y contraseña)
// - ✅ Agrega: Apto médico (subir desde Perfil) + estado OK/Pendiente (flag apto_medico_url)

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { navigationRef } from '../navigationRef';

const PerfilUsuarioScreen = () => {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { profile, updateProfile, uploadAvatar, logout, user, ensureProfile, organization } = useAuth();

  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [telefono, setTelefono] = useState('');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [objetivos, setObjetivos] = useState('');
  const [lesiones, setLesiones] = useState('');
  const [sexo, setSexo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);

  const [saving, setSaving] = useState(false);
  const [aptoSaving, setAptoSaving] = useState(false);

  // ---------------------------------------------
  // Cargar datos desde profile cuando cambia
  // ---------------------------------------------
  useEffect(() => {
    if (!profile) return;

    setNombre(profile.full_name || '');
    setUsername(profile.username || '');
    setTelefono(profile.phone || '');
    setEdad(profile.edad ? String(profile.edad) : '');
    setPeso(profile.peso != null ? String(profile.peso) : '');
    setObjetivos(profile.objetivos || '');
    setLesiones(profile.lesiones || '');
    setSexo(profile.sexo || '');
    setObservaciones(profile.observaciones || '');
    // avatar_url se setea en el efecto siguiente (puede ser URL pública o path de Storage)
  }, [profile]);

  // Avatar: solo URL pública (https) o path de Storage. file:// no existe tras borrar datos → no mostrar.
  useEffect(() => {
    const raw = profile?.avatar_url || null;
    if (!raw) {
      setAvatarUri(null);
      return;
    }
    if (String(raw).startsWith('file://')) {
      setAvatarUri(null);
      return;
    }
    if (/^https?:\/\//i.test(String(raw))) {
      setAvatarUri(raw);
      return;
    }
    try {
      const cleaned = String(raw).replace(/^avatars\//i, '');
      const { data } = supabase.storage.from('avatars').getPublicUrl(cleaned);
      setAvatarUri(data?.publicUrl || raw);
    } catch {
      setAvatarUri(null);
    }
  }, [profile?.avatar_url]);

  const sexoLabel = useMemo(() => {
    if (!sexo) return tStr('perfil_sex_unspecified');
    if (sexo === 'M') return tStr('perfil_sex_m');
    if (sexo === 'F') return tStr('perfil_sex_f');
    return sexo;
  }, [sexo, tStr]);

  const aptoOk = !!profile?.apto_medico_url;

  // ---------------------------------------------
  // Avatar: elegir foto y guardar avatar_url
  // ---------------------------------------------
  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(tStr('perfil_perm_gallery_title'), tStr('perfil_perm_gallery_body'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      const base64 = result.assets?.[0]?.base64;
      if (!uri) return;

      setAvatarUri(uri);

      const updatedUri = await uploadAvatar(uri, base64);
      if (updatedUri) {
        setAvatarUri(updatedUri);
        Alert.alert(tStr('perfil_avatar_ok_title'), tStr('perfil_avatar_ok_body'));
      } else {
        setAvatarUri(profile?.avatar_url || null);
        Alert.alert(tStr('perfil_avatar_fail_title'), tStr('perfil_avatar_fail_body'));
      }
    } catch (error) {
      console.log('handlePickAvatar error:', error);
      setAvatarUri(profile?.avatar_url || null);
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('perfil_avatar_error'));
    }
  };

  // ---------------------------------------------
  // Apto médico: seleccionar archivo y guardar flag en profiles.apto_medico_url
  // (por ahora flag simple, igual que en RegistroCompleto)
  // ---------------------------------------------
  const handlePickApto = async () => {
    if (!profile?.id) {
      Alert.alert(tStr('perfil_no_user_title'), tStr('perfil_no_user_body'));
      return;
    }

    try {
      setAptoSaving(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      // Flag simple (mismo criterio actual)
      const updated = await updateProfile({
        apto_medico_url: 'apto-subido',
      });

      if (!updated) {
        throw new Error(tStr('perfil_apto_flag_error'));
      }

      Alert.alert(tStr('perfil_avatar_ok_title'), tStr('perfil_apto_ok'));
    } catch (e) {
      console.log('handlePickApto error:', e?.message || e, e);
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('perfil_apto_error'));
    } finally {
      setAptoSaving(false);
    }
  };

  // ---------------------------------------------
  // Guardar cambios de perfil
  // ---------------------------------------------
  const handleGuardarCambios = async () => {
    if (!profile?.id) {
      Alert.alert(tStr('perfil_no_user_title'), tStr('perfil_no_user_body'));
      return;
    }

    try {
      setSaving(true);

      const payload = {
        full_name: nombre || null,
        username: username || null,
        phone: telefono || null,
        edad: edad ? parseInt(edad, 10) : null,
        peso: peso ? Number(peso) : null,
        objetivos: objetivos || null,
        lesiones: lesiones || null,
        sexo: sexo || null,
        observaciones: observaciones || null,
      };

      const updated = await updateProfile(payload);

      if (!updated) {
        throw new Error(tStr('perfil_update_error'));
      }

      Alert.alert(tStr('perfil_avatar_ok_title'), tStr('perfil_saved_ok'));
    } catch (err) {
      console.log('Error handleGuardarCambios PerfilUsuarioScreen:', err);
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('perfil_save_fail'));
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------
  // Logout + reset robusto al Welcome
  // ---------------------------------------------
  const resetToWelcome = () => {
    // 1) Intentar reset global desde la ref del NavigationContainer
    // eslint-disable-next-line no-console
    console.log('🔁 Perfil.resetToWelcome: start', {
      navReady: navigationRef.isReady?.() || false,
    });

    if (navigationRef.isReady()) {
      try {
        // eslint-disable-next-line no-console
        console.log('🔁 Perfil.resetToWelcome: usando navigationRef.resetRoot');
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: 'WelcomeGlobal' }],
        });
        return true;
      } catch {
        // seguir probando con navegadores locales
        // eslint-disable-next-line no-console
        console.log('⚠️ Perfil.resetToWelcome: fallo resetRoot, probando navegadores locales');
      }
    }

    // 2) Fallback: recorrer padres (tabs -> stack)
    const navs = [navigation?.getParent?.()?.getParent?.(), navigation?.getParent?.(), navigation].filter(
      Boolean
    );

    for (const nav of navs) {
      try {
        // eslint-disable-next-line no-console
        console.log('🔁 Perfil.resetToWelcome: nav.reset en', {
          hasParent: !!navigation?.getParent?.(),
        });
        nav.reset({
          index: 0,
          routes: [{ name: 'WelcomeGlobal' }],
        });
        return true;
      } catch {
        // seguir probando con otros navegadores
      }
    }

    try {
      // eslint-disable-next-line no-console
      console.log('🔁 Perfil.resetToWelcome: navigation.navigate("Welcome") fallback');
      navigation.navigate('WelcomeGlobal');
      return true;
    } catch {
      // eslint-disable-next-line no-console
      console.log('❌ Perfil.resetToWelcome: todas las rutas fallaron');
      return false;
    }
  };

  const handleLogout = () => {
    // eslint-disable-next-line no-console
    console.log('🟡 Perfil.handleLogout: Alert de confirmación');
    Alert.alert(tStr('perfil_logout_title'), tStr('perfil_logout_message'), [
      { text: tStr('common_cancel'), style: 'cancel' },
      {
        text: tStr('perfil_logout_confirm'),
        style: 'destructive',
        onPress: () => {
          // ⚠️ Igual que en ClientScreen: no esperamos a que termine logout(), navegamos ya.
          // eslint-disable-next-line no-console
          console.log('▶️ Perfil.handleLogout: onPress -> logout() (fire-and-forget)');
          try {
            logout?.();
          } catch (error) {
            console.log('Error al cerrar sesión desde PerfilUsuarioScreen:', error);
            Alert.alert(tStr('gym_config_alert_title_error'), tStr('perfil_logout_error'));
          }
          // eslint-disable-next-line no-console
          console.log('✅ Perfil.handleLogout: llamando resetToWelcome() inmediatamente');
          resetToWelcome();
        },
      },
    ]);
  };

  // ---------------------------------------------
  // Fallback: si hay user pero profile viene vacío al entrar a Perfil, reintentar ensureProfile
  // ---------------------------------------------
  useEffect(() => {
    if (!user?.id) return;
    if (profile?.id) return;
    if (typeof ensureProfile !== 'function') return;

    // eslint-disable-next-line no-console
    console.log('🧩 Perfil: ensureProfile fallback para user', user.id);
    ensureProfile({ id: user.id }).catch((e) =>
      // eslint-disable-next-line no-console
      console.log('🧩 Perfil: ensureProfile fallback error', e?.message || e),
    );
  }, [user?.id, profile?.id, ensureProfile]);

  // ---------------------------------------------
  // Ir a Seguridad (cambio mail / contraseña)
  // ---------------------------------------------
  const handleGoSeguridad = () => {
    navigation.navigate('Seguridad');
  };

  const handleGoConfig = () => {
    navigation.navigate('Config');
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1 },
        container: { flexGrow: 1, padding: 20, paddingBottom: 32 },
        panel: {
          borderRadius: 18,
          padding: 18,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        titulo: { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 4 },
        subtitulo: { fontSize: 14, color: t.subText, marginBottom: 16 },
        gymRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
        gymLogo: { width: 40, height: 40, borderRadius: 8 },
        gymLogoPlaceholder: { backgroundColor: t.faintStrong, justifyContent: 'center', alignItems: 'center' },
        gymName: { fontSize: 16, fontWeight: '600', color: t.text, flex: 1 },
        avatarContainer: { alignItems: 'center', marginBottom: 16 },
        avatarCircle: {
          width: 96,
          height: 96,
          borderRadius: 48,
          borderWidth: 2,
          borderColor: t.brand,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.faintStrong,
          marginBottom: 8,
        },
        avatarImage: { width: 80, height: 80, borderRadius: 40, resizeMode: 'cover' },
        avatarText: { fontSize: 12, color: t.subText, textAlign: 'center' },
        section: { marginTop: 12, marginBottom: 8 },
        sectionTitle: { fontSize: 16, fontWeight: '600', color: t.text, marginBottom: 6 },
        aptoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
        aptoBadge: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        aptoBadgeText: { color: t.primaryText, fontWeight: '700', fontSize: 12 },
        aptoHint: { flex: 1, color: t.subText, fontSize: 12 },
        aptoButton: {
          borderRadius: 12,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          ...t.buttonPrimary,
        },
        aptoButtonText: { ...t.buttonPrimaryText, fontWeight: '600', fontSize: 14 },
        field: { marginBottom: 10 },
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
        },
        textArea: { minHeight: 60, textAlignVertical: 'top' },
        row: { flexDirection: 'row', justifyContent: 'space-between' },
        fieldHalf: { flex: 1 },
        smallHint: { marginTop: 3, fontSize: 11, color: t.subText },
        buttonsRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'center' },
        saveButton: {
          flexGrow: 1,
          borderRadius: 12,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          ...t.buttonPrimary,
        },
        saveButtonText: { ...t.buttonPrimaryText, fontWeight: '600', fontSize: 15 },
        securityButton: {
          flexGrow: 1,
          borderRadius: 12,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          ...t.buttonPrimary,
        },
        securityButtonText: { ...t.buttonPrimaryText, fontWeight: '500', fontSize: 14 },
        logoutButton: {
          flexGrow: 1,
          borderRadius: 12,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          ...t.buttonPrimary,
        },
        logoutButtonText: { ...t.buttonPrimaryText, fontWeight: '500', fontSize: 14 },
        backButton: {
          flexGrow: 1,
          borderRadius: 12,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          ...t.buttonPrimary,
        },
        backButtonText: { ...t.buttonPrimaryText, fontSize: 14 },
      }),
    [t],
  );

  // ---------------------------------------------
  // Render
  // ---------------------------------------------
  return (
    <BackgroundWrapper screen="ClientScreen">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.panel}>
            <Text style={styles.titulo}>{tStr('perfil_title')}</Text>
            <Text style={styles.subtitulo}>{tStr('perfil_subtitle')}</Text>

            {/* Mi gym (Brand & Logo spec: logo org en perfil de usuario) */}
            {organization && (
              <View style={styles.gymRow}>
                {organization.logo_url ? (
                  <Image source={{ uri: organization.logo_url }} style={styles.gymLogo} />
                ) : (
                  <View style={[styles.gymLogo, styles.gymLogoPlaceholder]}>
                    <Ionicons name="business" size={22} color={t.subText} />
                  </View>
                )}
                <Text style={styles.gymName}>{organization.name || 'Mi gym'}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAvatar} activeOpacity={0.9}>
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person-circle-outline" size={80} color={t.primaryText} />
                )}
              </View>
              <Text style={styles.avatarText}>{tStr('perfil_avatar_hint')}</Text>
            </TouchableOpacity>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{tStr('perfil_apto_medico')}</Text>

              <View style={styles.aptoRow}>
                <View style={styles.aptoBadge}>
                  <Text style={styles.aptoBadgeText}>{aptoOk ? tStr('client_apto_ok') : tStr('client_apto_pendiente')}</Text>
                </View>

                <Text style={styles.aptoHint}>
                  {aptoOk ? tStr('perfil_apto_ok') : tStr('perfil_apto_upload_hint')}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.aptoButton, aptoSaving ? { opacity: 0.75 } : null]}
                onPress={handlePickApto}
                disabled={aptoSaving}
                activeOpacity={0.9}
              >
                {aptoSaving ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={t.primaryText} />
                    <Text style={styles.aptoButtonText}>{tStr('perfil_saving_apto')}</Text>
                  </View>
                ) : (
                  <Text style={styles.aptoButtonText}>
                    {aptoOk ? tStr('perfil_replace_apto') : tStr('perfil_upload_apto')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{tStr('perfil_datos_basicos')}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>{tStr('perfil_nombre')}</Text>
                <TextInput
                  style={styles.input}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder={tStr('perfil_placeholder_name')}
                  placeholderTextColor={t.placeholder}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{tStr('perfil_usuario')}</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={tStr('perfil_placeholder_username')}
                  placeholderTextColor={t.placeholder}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{tStr('perfil_telefono')}</Text>
                <TextInput
                  style={styles.input}
                  value={telefono}
                  onChangeText={setTelefono}
                  placeholder={tStr('perfil_placeholder_phone')}
                  placeholderTextColor={t.placeholder}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, styles.fieldHalf]}>
                  <Text style={styles.label}>{tStr('perfil_edad')}</Text>
                  <TextInput
                    style={styles.input}
                    value={edad}
                    onChangeText={setEdad}
                    placeholder={tStr('perfil_placeholder_age')}
                    placeholderTextColor={t.placeholder}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.field, styles.fieldHalf, { marginLeft: 10 }]}>
                  <Text style={styles.label}>{tStr('perfil_peso')}</Text>
                  <TextInput
                    style={styles.input}
                    value={peso}
                    onChangeText={setPeso}
                    placeholder={tStr('perfil_placeholder_weight')}
                    placeholderTextColor={t.placeholder}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{tStr('perfil_sexo')}</Text>
                <TextInput
                  style={styles.input}
                  value={sexo}
                  onChangeText={setSexo}
                  placeholder={tStr('perfil_placeholder_sex')}
                  placeholderTextColor={t.placeholder}
                  autoCapitalize="characters"
                />
                <Text style={styles.smallHint}>{tStr('perfil_actual')}: {sexoLabel}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{tStr('perfil_entrenamiento')}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>{tStr('perfil_objetivos')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={objetivos}
                  onChangeText={setObjetivos}
                  placeholder={tStr('perfil_placeholder_objetivos')}
                  placeholderTextColor={t.placeholder}
                  multiline
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{tStr('perfil_lesiones')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={lesiones}
                  onChangeText={setLesiones}
                  placeholder={tStr('perfil_placeholder_lesiones')}
                  placeholderTextColor={t.placeholder}
                  multiline
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{tStr('perfil_notas')}</Text>
              <View style={styles.field}>
                <Text style={styles.label}>{tStr('perfil_observaciones')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={observaciones}
                  onChangeText={setObservaciones}
                  placeholder={tStr('perfil_placeholder_observaciones')}
                  placeholderTextColor={t.placeholder}
                  multiline
                />
              </View>
            </View>

            {/* BOTÓN GUARDAR */}
            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.saveButton, saving ? { opacity: 0.75 } : null]}
                onPress={handleGuardarCambios}
                disabled={saving}
                activeOpacity={0.9}
              >
                <Text style={styles.saveButtonText}>{saving ? tStr('perfil_guardando') : tStr('perfil_guardar')}</Text>
              </TouchableOpacity>
            </View>

            {/* BOTÓN CONFIGURACIÓN */}
            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.securityButton} onPress={handleGoConfig} activeOpacity={0.9}>
                <Ionicons name="settings-outline" size={18} color={t.primaryText} />
                <Text style={styles.securityButtonText}>{tStr('perfil_config')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.securityButton} onPress={handleGoSeguridad} activeOpacity={0.9}>
                <Ionicons name="shield-checkmark-outline" size={18} color={t.primaryText} />
                <Text style={styles.securityButtonText}>{tStr('perfil_seguridad')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.9}>
                <Ionicons name="log-out-outline" size={18} color={t.primaryText} />
                <Text style={styles.logoutButtonText}>{tStr('perfil_logout')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.9}>
                <Ionicons name="arrow-back" size={18} color={t.primaryText} />
                <Text style={styles.backButtonText}>{tStr('config_back')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
};

export default PerfilUsuarioScreen;
