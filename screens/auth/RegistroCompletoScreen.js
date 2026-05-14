// screens/RegistroCompletoScreen.js — Waitomo Dark Only (perfil completo real)
// - Usa AuthContext para guardar datos en Supabase (profiles)
// - Sube avatar al bucket "avatars" y guarda avatar_url
// - Marca apto_médico con un flag simple (apto_medico_url != null)
// - Completa username con el "usuario" del registro inicial si faltaba
// - Navega al flujo cliente (ClientTabs) con perfil ya actualizado

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import { colors } from '../../theme/colors';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { getClientPostAuthRouteName } from '../../utils/clientPostAuthRoute';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';
import { AuthKeyboardAvoidingView, authScrollKeyboardDismissMode } from '../../components/AuthWebFormShell';

// ---------- helpers ----------
const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full =
    clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const addDaysIso = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString();
};

export default function RegistroCompletoScreen({ route, navigation }) {
  const { plan, userData } = route?.params || {};
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  // ✅ FIX: necesitamos user/ensureProfile para NO depender de profile hidratado
  const { user, profile, ensureProfile, updateProfile, uploadAvatar } = useAuth();

  const [edad, setEdad] = useState('');
  const [sexo, setSexo] = useState('');
  const [peso, setPeso] = useState('');
  const [objetivos, setObjetivos] = useState('');
  const [lesiones, setLesiones] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [imagenPerfil, setImagenPerfil] = useState(null);
  const [imagenPerfilBase64, setImagenPerfilBase64] = useState(null);
  const [aptoMedico, setAptoMedico] = useState(null);
  const [saving, setSaving] = useState(false);

  // ✅ FIX: aviso inline (no modal) cuando profile todavía no hidrató
  const [sessionPending, setSessionPending] = useState(false);

  // ✅ FIX: anti doble tap / estados raros
  const guardRef = useRef(false);

  useEffect(() => {
    // Si aparece el profile, apagamos el aviso
    if (profile?.id) setSessionPending(false);
  }, [profile?.id]);

  const seleccionarImagen = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImagenPerfil(result.assets[0].uri);
      setImagenPerfilBase64(result.assets[0].base64 ?? null);
    }
  };

  const seleccionarApto = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
    });
    if (!result.canceled) {
      setAptoMedico(result.assets?.[0]?.uri || result.uri);
    }
  };

  // ✅ PATCH: sin Promise.race / sin timeout fake (usa timeout real del supabaseClient)
  const handleContinuar = async () => {
    if (guardRef.current) return;
    guardRef.current = true;

    let navigated = false;
    const goPanel = (perfilParaNav) => {
      if (navigated) return;
      navigated = true;

      const routeName = getClientPostAuthRouteName(perfilParaNav);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: routeName,
            params:
              routeName === 'ClientTabs'
                ? { userData: perfilParaNav, plan }
                : undefined,
          },
        ],
      });
    };

    try {
      setSaving(true);

      if (!edad || !sexo || !peso || !objetivos) {
        Alert.alert(tStr('reg_complete_alert_missing_title'), tStr('reg_complete_alert_missing_body'));
        return;
      }

      if (!user?.id) {
        Alert.alert(tStr('reg_complete_alert_no_session_title'), tStr('reg_complete_alert_no_session_body'));
        return;
      }

      console.log('🟡 [RegistroCompleto] userId =>', user.id);
      console.log('🟡 [RegistroCompleto] profile?.id =>', profile?.id);

      // ✅ 1) Asegurar profile SIN timeout fake
      let profileRef = profile;

      if (!profileRef?.id) {
        setSessionPending(true);

        if (typeof ensureProfile === 'function') {
          try {
            const ensured = await ensureProfile({
              id: user.id,
              full_name: userData?.nombre || null,
              phone: userData?.telefono || null,
              username: null,
              plan_actual: plan?.id || plan?.nombre || plan?.title || null,
            });

            if (ensured?.id) profileRef = ensured;
          } catch (e) {
            console.log(
              '❌ [RegistroCompleto] ensureProfile error REAL:',
              e?.message || e,
              e
            );
            Alert.alert(tStr('reg_complete_alert_ensure_fail_title'), tStr('reg_complete_alert_ensure_fail_body'));
            return;
          } finally {
            setSessionPending(false);
          }
        } else {
          setSessionPending(false);
          console.log('❌ [RegistroCompleto] ensureProfile NO existe en AuthContext');
          Alert.alert(tStr('reg_complete_alert_no_ensure_title'), tStr('reg_complete_alert_no_ensure_body'));
          return;
        }

        if (!profileRef?.id) {
          Alert.alert(tStr('reg_complete_alert_profile_fail_title'), tStr('reg_complete_alert_profile_fail_body'));
          return;
        }
      }

      // ✅ 2) Avatar (no bloquea el flujo si falla)
      let avatarUrl = profileRef?.avatar_url || null;

      if (imagenPerfil && typeof uploadAvatar === 'function') {
        try {
          const uploadedUrl = await uploadAvatar(imagenPerfil, imagenPerfilBase64);
          if (uploadedUrl) avatarUrl = uploadedUrl;
        } catch (e) {
          console.log(
            '🟠 [RegistroCompleto] uploadAvatar error REAL (continúo igual):',
            e?.message || e,
            e
          );
        }
      }

      // ✅ 3) Payload final (DB)
const planActual = plan?.id || plan?.nombre || plan?.title || null;

const payload = {
  edad: edad ? Number(edad) : null,
  peso: peso ? Number(peso) : null,
  sexo: sexo || null,
  objetivos: objetivos || null,
  lesiones: lesiones || null,
  observaciones: observaciones || null,

  // 🔥 CLAVE: esto es lo que usa el panel para “plan activo”
  plan_actual: planActual,

  ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  ...(aptoMedico
    ? {
        apto_medico_url: 'apto-subido',
        apto_medico_uploaded_at: new Date().toISOString(),
        apto_medico_expires_at: addDaysIso(365),
      }
    : {}),
};

// ✅ Completar phone si todavía no existe
if (!profileRef?.phone && userData?.telefono) {
  payload.phone = userData.telefono;
}

console.log('🟡 [RegistroCompleto] payload =>', payload);



      // ✅ 4) Update profile SIN timeout fake
      let updated = null;

      const UPD_START = Date.now();
      console.log('🧠 [RegistroCompleto] updateProfile START', {
        userId: user?.id || null,
        profileId: profile?.id || null,
        payloadKeys: Object.keys(payload || {}),
      });

      try {
        updated = await updateProfile(payload);

        console.log('✅ [RegistroCompleto] updateProfile OK', {
          ms: Date.now() - UPD_START,
          updatedType: typeof updated,
          updatedId: updated?.id || null,
          returnedKeys:
            updated && typeof updated === 'object' ? Object.keys(updated) : null,
          // preview chico (para no spamear)
          preview:
            updated && typeof updated === 'object'
              ? {
                  edad: updated.edad ?? null,
                  peso: updated.peso ?? null,
                  sexo: updated.sexo ?? null,
                  username: updated.username ?? null,
                }
              : null,
        });
      } catch (e) {
        console.log(
          '❌ [RegistroCompleto] updateProfile CATCH (error REAL):',
          {
            ms: Date.now() - UPD_START,
            msg: e?.message || String(e),
          },
          e
        );

        Alert.alert(tStr('reg_complete_alert_save_fail_title'), tStr('reg_complete_alert_save_fail_body'));
        return;
      }

      if (!updated) {
        console.log('❌ [RegistroCompleto] updateProfile devolvió null/undefined', {
          ms: Date.now() - UPD_START,
        });
        throw new Error('updateProfile devolvió null/undefined');
      }

      const perfilParaNav = {
        ...(userData || {}),
        ...(typeof updated === 'object' ? updated : payload),
      };

      // ✅ Navega sí o sí
      setTimeout(() => goPanel(perfilParaNav), 300);

      Alert.alert(
        tStr('reg_complete_success_title'),
        tStr('reg_complete_success_body'),
        [{ text: tStr('reg_complete_go_panel'), onPress: () => goPanel(perfilParaNav) }],
        { cancelable: false }
      );
    } catch (e) {
      console.log('❌ [RegistroCompleto] handleContinuar error:', e?.message || e, e);
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('reg_complete_error_final'));
    } finally {
      setSaving(false);
      setSessionPending(false);
      guardRef.current = false;
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        kav: { flex: 1 },
        scroll: {
          flexGrow: 1,
          padding: MOBILE_SPACING.xl,
          paddingBottom: 40,
          paddingTop: 60,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1.2,
          padding: MOBILE_SPACING.xl,
        },
        title: {
          color: t.brand,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: 10,
          textAlign: 'center',
        },

        // ✅ FIX (estética Waitomo): banner inline de sesión + loader visible
        banner: {
          marginBottom: 18,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: hexToRgba(t.brand, 0.45),
          backgroundColor: hexToRgba('#000', 0.35),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,

          // glow sutil Waitomo
          shadowColor: t.brand,
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
        loaderWrap: {
          width: 34,
          height: 34,
          borderRadius: MOBILE_RADII.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hexToRgba(t.brand, 0.10),
          borderWidth: 1,
          borderColor: hexToRgba(t.brand, 0.25),
        },
        bannerText: {
          color: t.text,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '800',
        },
        bannerSub: {
          marginTop: 2,
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '600',
          opacity: 0.9,
        },

        imagePicker: {
          alignSelf: 'center',
          marginBottom: 25,
        },
        imagePlaceholder: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 65,
          borderWidth: 1,
          height: 130,
          justifyContent: 'center',
          width: 130,
        },
        placeholderText: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          textAlign: 'center',
        },
        imagePreview: {
          borderColor: t.overlayBorder,
          borderRadius: 65,
          borderWidth: 1,
          height: 130,
          width: 130,
        },

        input: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          color: t.text,
          marginBottom: 15,
          padding: 12,
        },

        aptoButton: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          marginBottom: 20,
          padding: 12,
        },
        aptoText: {
          color: t.brand2,
          fontWeight: 'bold',
        },

        button: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.md,
          marginTop: 4,
          padding: MOBILE_SPACING.lg,
          opacity: saving ? 0.75 : 1,
        },
        buttonText: {
          ...t.buttonPrimaryText,
          fontWeight: 'bold',
        },
      }),
    [t, saving]
  );

  return (
    <BackgroundWrapper plan={plan}>
      <AuthKeyboardAvoidingView style={styles.kav}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={authScrollKeyboardDismissMode}
        >
          <NeoPanel style={styles.panel}>
            <Text style={styles.title}>{tStr('reg_complete_title')}</Text>

            {/* ✅ FIX (estética): banner solo cuando ESTAMOS asegurando sesión (no por !profile) */}
            {sessionPending && (
              <View style={styles.banner}>
                <View style={styles.loaderWrap}>
                  <ActivityIndicator size="small" color={t.brand} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerText}>{tStr('reg_complete_banner_main')}</Text>
                  <Text style={styles.bannerSub}>{tStr('reg_complete_banner_sub')}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.imagePicker} onPress={seleccionarImagen}>
              {imagenPerfil ? (
                <Image source={{ uri: imagenPerfil }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.placeholderText}>{tStr('reg_complete_photo_hint')}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder={tStr('reg_complete_ph_edad')}
              placeholderTextColor={t.placeholder}
              keyboardType="numeric"
              value={edad}
              onChangeText={setEdad}
            />
            <TextInput
              style={styles.input}
              placeholder={tStr('reg_complete_ph_sexo')}
              placeholderTextColor={t.placeholder}
              value={sexo}
              onChangeText={setSexo}
            />
            <TextInput
              style={styles.input}
              placeholder={tStr('reg_complete_ph_peso')}
              placeholderTextColor={t.placeholder}
              keyboardType="numeric"
              value={peso}
              onChangeText={setPeso}
            />
            <TextInput
              style={styles.input}
              placeholder={tStr('reg_complete_ph_objetivos')}
              placeholderTextColor={t.placeholder}
              value={objetivos}
              onChangeText={setObjetivos}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder={tStr('reg_complete_ph_lesiones')}
              placeholderTextColor={t.placeholder}
              value={lesiones}
              onChangeText={setLesiones}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder={tStr('reg_complete_ph_obs')}
              placeholderTextColor={t.placeholder}
              value={observaciones}
              onChangeText={setObservaciones}
              multiline
            />

            <TouchableOpacity style={styles.aptoButton} onPress={seleccionarApto}>
              <Text style={styles.aptoText}>
                {aptoMedico ? tStr('reg_complete_apto_loaded') : tStr('reg_complete_apto_upload')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={handleContinuar}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? tStr('reg_complete_saving') : tStr('reg_complete_continue')}
              </Text>
            </TouchableOpacity>
            <BackNavButton onPress={() => navigation.goBack()} style={{ marginTop: MOBILE_SPACING.md }} />
          </NeoPanel>
        </ScrollView>
      </AuthKeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
