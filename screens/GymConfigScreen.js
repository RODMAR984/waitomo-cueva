// GymConfigScreen — Configuración de la organización (nombre, logo, color de acento)
// Solo owner/superadmin de la org. Fase 4.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  BackHandler,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { supabase } from '../supabaseClient';
import { getThemeTokens } from '../theme/colors';
import { imageUriToArrayBuffer } from '../utils/imageUriToArrayBuffer';
import LogoCompleto from '../components/LogoCompleto';

const hexToRgba = (hex, alpha) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const BUCKET_ORG_LOGOS = 'org-logos';
const BUCKET_ORG_BACKGROUNDS = 'org-backgrounds';

const PRESET_LABELS_GYM = {
  dark_vivid: 'Oscuro vivo',
  dark_minimal: 'Oscuro minimal',
  light_clean: 'Claro limpio',
  light_warm: 'Claro cálido',
};

const PRESET_HINTS_GYM = {
  dark_vivid: 'Acento en paneles + textos fríos (cian/azul). Muy “neon”.',
  dark_minimal: 'Casi blanco y negro + zinc; el acento casi solo en botones.',
  light_clean: 'Blanco frío, bordes grises, sombra suave tipo SaaS.',
  light_warm: 'Crema, bordes melocotón, marrón en subtítulos.',
};

const TEXT_QUICK_GYM = [
  '#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#a5b4fc', '#818cf8', '#c4b5fd', '#93c5fd',
  '#67e8f9', '#5eead4', '#86efac', '#bef264', '#fef08a', '#fed7aa', '#fda4af', '#fce7f3',
  '#fecdd3', '#ecfccb', '#d9f99d', '#ffffff', '#0f172a', '#1e293b', '#334155', '#431407',
  '#7c2d12', '#881337', '#4c1d95', '#14532d',
];
/** Secundario: subtítulos y ayudas (elige un tono que contraste con el principal). */
const TEXT_SECOND_QUICK_GYM = [
  '#f1f5f9', '#cbd5e1', '#94a3b8', '#64748b', '#4b5563', '#475569', '#334155', '#1f2937',
  '#a8a29e', '#78716c', '#57534e', '#0ea5e9', '#38bdf8', '#22d3ee', '#14b8a6', '#34d399',
  '#a3e635', '#eab308', '#fb923c', '#f472b6', '#c084fc', '#c2410c', '#9a3412', '#be185d',
  '#9d174d', '#6b21a8', '#166534',
];
const TEXT_PALETTES_GYM = [
  { key: 'neon', label: 'Neon', primary: '#e2e8f0', secondary: '#22d3ee' },
  { key: 'minimal', label: 'Minimal', primary: '#f8fafc', secondary: '#a1a1aa' },
  { key: 'clean', label: 'Clean', primary: '#0f172a', secondary: '#475569' },
  { key: 'warm', label: 'Warm', primary: '#431407', secondary: '#9a3412' },
  { key: 'rose', label: 'Rose', primary: '#fce7f3', secondary: '#be185d' },
  { key: 'forest', label: 'Forest', primary: '#ecfccb', secondary: '#166534' },
  { key: 'gold', label: 'Gold', primary: '#fef08a', secondary: '#a16207' },
  { key: 'ocean', label: 'Ocean', primary: '#93c5fd', secondary: '#0369a1' },
  { key: 'studio', label: 'Studio', primary: '#fafafa', secondary: '#71717a' },
  { key: 'lavender', label: 'Lavanda', primary: '#ede9fe', secondary: '#6d28d9' },
  { key: 'slate', label: 'Slate', primary: '#e2e8f0', secondary: '#475569' },
  { key: 'coral', label: 'Coral', primary: '#fff7ed', secondary: '#ea580c' },
];
const HEX_TEXT_COLOR = /^#([0-9A-F]{6})$/i;

const getEffectiveMode = (mode) => {
  if (mode !== 'auto') return mode;
  const h = new Date().getHours();
  return h >= 6 && h < 22 ? 'light' : 'dark';
};

export default function GymConfigScreen() {
  const navigation = useNavigation();
  const { t, mode } = useThemeContext();
  const { user, profile, organization, refreshOrganization } = useAuth() || {};
  const orgId = organization?.id || profile?.organization_id;

  const [name, setName] = useState(organization?.name || '');
  const [accentColor, setAccentColor] = useState(organization?.accent_color || '#00dddd');
  const [logoUri, setLogoUri] = useState(organization?.logo_url || null);
  const [themePreset, setThemePreset] = useState(organization?.theme_preset || 'dark_vivid');
  const [backgroundType, setBackgroundType] = useState(organization?.background_type || 'solid');
  const [backgroundUrl, setBackgroundUrl] = useState(organization?.background_url || '');
  const [backgroundLocalUri, setBackgroundLocalUri] = useState(null);
  const [textColor, setTextColor] = useState(
    organization?.features?.text_color || organization?.text_color || ''
  );
  const [textSecondaryColor, setTextSecondaryColor] = useState(
    organization?.features?.text_secondary_color || ''
  );
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      setAccentColor(organization.accent_color || '#00dddd');
      setLogoUri(organization.logo_url || null);
      setThemePreset(organization.theme_preset || 'dark_vivid');
      setBackgroundType(organization.background_type || 'solid');
      setBackgroundUrl(organization.background_url || '');
      setBackgroundLocalUri(null);
      setTextColor(organization.features?.text_color || organization.text_color || '');
      setTextSecondaryColor(organization.features?.text_secondary_color || '');
    }
  }, [
    organization?.id,
    organization?.name,
    organization?.accent_color,
    organization?.logo_url,
    organization?.theme_preset,
    organization?.background_type,
    organization?.background_url,
    organization?.features,
    organization?.text_color,
  ]);

  // Android: atrás del sistema debe volver al panel, no cerrar la app si el stack quedó raro.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (navigation.canGoBack()) {
          navigation.goBack();
          return true;
        }
        try {
          navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
        } catch (_) {
          navigation.navigate('AdminLite');
        }
        return true;
      });
      return () => sub.remove();
    }, [navigation])
  );

  const isOwner = !!(organization?.owner_id && (organization.owner_id === user?.id || organization.owner_id === profile?.id));
  const canEdit = isOwner || profile?.role === 'superadmin';
  const validTextColor = HEX_TEXT_COLOR.test((textColor || '').trim()) ? textColor.trim() : null;
  const validTextSecondary = HEX_TEXT_COLOR.test((textSecondaryColor || '').trim())
    ? textSecondaryColor.trim()
    : null;
  const previewOrg = useMemo(() => {
    const feats = {};
    if (validTextColor) feats.text_color = validTextColor;
    if (validTextSecondary) feats.text_secondary_color = validTextSecondary;
    return {
      id: organization?.id,
      name: name || organization?.name,
      accent_color: (accentColor || '').trim() || '#00dddd',
      theme_preset: themePreset || 'dark_vivid',
      features: Object.keys(feats).length ? feats : undefined,
    };
  }, [
    organization?.id,
    organization?.name,
    name,
    accentColor,
    themePreset,
    validTextColor,
    validTextSecondary,
  ]);
  const previewTokensCurrent = useMemo(
    () => getThemeTokens(getEffectiveMode(mode), previewOrg),
    [mode, previewOrg]
  );
  const previewTokensDark = useMemo(() => getThemeTokens('dark', previewOrg), [previewOrg]);
  const previewTokensLight = useMemo(() => getThemeTokens('light', previewOrg), [previewOrg]);

  const pickAndUploadLogo = async () => {
    if (!orgId) {
      Alert.alert('Error', 'No hay organización cargada.');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso', 'Se necesita acceso a la galería para subir el logo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingLogo(true);
      const uri = result.assets[0].uri;
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
      const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : 'jpg';
      const path = `${orgId}/logo.${safeExt}`;

      const body = await imageUriToArrayBuffer(uri);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ORG_LOGOS)
        .upload(path, body, { contentType: `image/${safeExt === 'png' ? 'png' : 'jpeg'}`, upsert: true });

      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET_ORG_LOGOS).getPublicUrl(path);
      const publicUrl = data?.publicUrl || null;
      if (publicUrl) setLogoUri(publicUrl);
    } catch (e) {
      console.log('GymConfig logo upload:', e?.message || e);
      Alert.alert(
        'Logo',
        e?.message?.includes('Bucket') ? 'Creá el bucket "org-logos" en Supabase Storage (público) y volvé a intentar.' : (e?.message || 'No se pudo subir el logo.')
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const pickAndUploadBackground = async () => {
    if (!orgId) {
      Alert.alert('Error', 'No hay organización cargada.');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso', 'Se necesita acceso a la galería para elegir el fondo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingBackground(true);
      const uri = result.assets[0].uri;
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
      const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'jpg';
      const path = `${orgId}/background.${safeExt}`;

      const body = await imageUriToArrayBuffer(uri);
      const contentType = safeExt === 'png' ? 'image/png' : 'image/jpeg';
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ORG_BACKGROUNDS)
        .upload(path, body, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET_ORG_BACKGROUNDS).getPublicUrl(path);
      const publicUrl = data?.publicUrl || null;
      if (publicUrl) {
        setBackgroundLocalUri(uri);
        setBackgroundUrl(publicUrl);
      }
    } catch (e) {
      Alert.alert('Fondo', e?.message || 'No se pudo subir la imagen de fondo.');
    } finally {
      setUploadingBackground(false);
    }
  };

  const save = async () => {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      Alert.alert('Nombre', 'El nombre de la organización es obligatorio.');
      return;
    }
    if (!orgId) {
      Alert.alert('Error', 'No hay organización cargada.');
      return;
    }
    if (!canEdit) {
      Alert.alert('Sin permiso', 'Solo el dueño de la organización puede editar la configuración.');
      return;
    }
    setSaving(true);
    try {
      const prevFeatures =
        organization?.features && typeof organization.features === 'object' && !Array.isArray(organization.features)
          ? { ...organization.features }
          : {};
      if (validTextColor) prevFeatures.text_color = validTextColor;
      else delete prevFeatures.text_color;
      if (validTextSecondary) prevFeatures.text_secondary_color = validTextSecondary;
      else delete prevFeatures.text_secondary_color;

      const { error } = await supabase
        .from('organizations')
        .update({
          name: trimmedName,
          accent_color: (accentColor || '').trim() || '#00dddd',
          logo_url: logoUri || null,
          theme_preset: themePreset || 'dark_vivid',
          background_type: backgroundType || 'solid',
          background_url: (backgroundUrl || '').trim() || null,
          features: prevFeatures,
        })
        .eq('id', orgId);
      if (error) throw error;
      if (typeof refreshOrganization === 'function') await refreshOrganization();
      Alert.alert('Guardado', 'La configuración se actualizó correctamente.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, padding: 20, paddingTop: 56 },
        header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
        backBtn: { padding: 8, marginLeft: -8 },
        title: { color: t.text, fontSize: 22, fontWeight: '800', marginLeft: 8 },
        scroll: { paddingBottom: 40 },
        block: { marginBottom: 20 },
        label: { color: t.subText, fontSize: 13, marginBottom: 8, fontWeight: '600' },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          padding: 12,
          color: t.text,
          backgroundColor: t.inputBg,
          fontSize: 15,
        },
        logoWrap: {
          width: 100,
          height: 100,
          borderRadius: 14,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        logoImg: { width: '100%', height: '100%' },
        logoBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: hexToRgba(t.brand, 0.2), borderRadius: 10, alignSelf: 'flex-start' },
        logoBtnSpaced: { marginTop: 12 },
        logoBtnText: { color: t.brand, fontSize: 14, fontWeight: '600' },
        saveBtn: { ...t.buttonPrimary, borderRadius: 10, paddingVertical: 14, marginTop: 18, alignItems: 'center' },
        saveBtnText: { ...t.buttonPrimaryText, fontSize: 16 },
        hint: { color: t.placeholder, fontSize: 12, marginTop: 6 },
        previewCard: {
          borderRadius: 12,
          borderWidth: 1,
          padding: 14,
          marginTop: 6,
        },
        previewTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
        previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        previewBadge: { borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1 },
        previewBadgeText: { fontSize: 13, fontWeight: '700' },
        paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
        paletteBtn: {
          borderWidth: 1,
          borderRadius: 10,
          paddingVertical: 9,
          paddingHorizontal: 10,
          minWidth: 92,
        },
        paletteSwatches: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
        paletteDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, marginRight: 6 },
        paletteLabel: { fontSize: 12, fontWeight: '700' },
        bgPreviewWrap: {
          width: '100%',
          height: 120,
          borderRadius: 12,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginTop: 10,
          marginBottom: 6,
        },
        bgPreviewImg: { width: '100%', height: '100%' },
      }),
    [t]
  );

  if (!orgId) {
    return (
      <BackgroundWrapper screen="admin">
        <View style={styles.screen}>
          <Text style={styles.title}>Cargando...</Text>
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper screen="admin">
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={26} color={t.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Configuración del gym</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Nombre de la organización</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej. Waitomo Training"
            placeholderTextColor={t.placeholder}
            editable={isOwner}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Color de acento (hex)</Text>
          <TextInput
            style={styles.input}
            value={accentColor}
            onChangeText={setAccentColor}
            placeholder="#00dddd"
            placeholderTextColor={t.placeholder}
            editable={isOwner}
          />
          <Text style={styles.hint}>Se usa en botones y destacados. Ej: #00dddd</Text>
          {[{ key: 'dark', label: 'Preview oscuro', token: previewTokensDark }, { key: 'light', label: 'Preview claro', token: previewTokensLight }].map(({ key, label, token }) => (
            <View
              key={key}
              style={[
                styles.previewCard,
                {
                  backgroundColor: token.boxBg,
                  borderColor: token.overlayBorder,
                  marginTop: key === 'light' ? 10 : 6,
                },
              ]}
            >
              <Text style={[styles.previewTitle, { color: token.text }]}>{label}</Text>
              <Text style={{ color: token.text, fontSize: 17, fontWeight: '800', marginBottom: 4 }}>
                Título principal
              </Text>
              <Text style={{ color: token.subText, fontSize: 14, marginBottom: 12 }}>
                Texto secundario · placeholders
              </Text>
              <View style={styles.previewRow}>
                <View
                  style={[
                    styles.previewBadge,
                    { backgroundColor: token.buttonPrimary.backgroundColor, borderColor: token.buttonPrimary.borderColor },
                  ]}
                >
                  <Text style={[styles.previewBadgeText, { color: token.buttonPrimaryText.color }]}>Acción</Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    marginLeft: 10,
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: token.overlayBorder,
                    backgroundColor: token.inactiveTabBg,
                  }}
                >
                  <Text style={{ color: token.subText, fontSize: 11 }}>Tarjeta / panel</Text>
                </View>
              </View>
            </View>
          ))}
          <Text style={styles.hint}>
            Vista actual según modo de la app: {getEffectiveMode(mode)} · texto: {previewTokensCurrent.text} · secundario: {previewTokensCurrent.subText}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Preset de tema</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['dark_vivid', 'dark_minimal', 'light_clean', 'light_warm'].map((preset) => (
              <TouchableOpacity
                key={preset}
                onPress={() => canEdit && setThemePreset(preset)}
                style={[
                  { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: t.overlayBorder },
                  themePreset === preset && { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.15) },
                ]}
              >
                <Text style={{ color: themePreset === preset ? t.brand : t.subText, fontSize: 13, fontWeight: '700' }}>
                  {PRESET_LABELS_GYM[preset] || preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>{PRESET_HINTS_GYM[themePreset] || ''}</Text>
          <Text style={styles.hint}>Cambiá también el modo claro/oscuro de la app en Configuración para ver presets claros.</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Paletas rápidas (primario + secundario)</Text>
          <Text style={styles.hint}>Aplican ambos colores juntos para mantener buena jerarquía visual.</Text>
          <View style={styles.paletteRow}>
            {TEXT_PALETTES_GYM.map((palette) => {
              const isActive =
                validTextColor?.toLowerCase() === palette.primary.toLowerCase() &&
                validTextSecondary?.toLowerCase() === palette.secondary.toLowerCase();
              return (
                <TouchableOpacity
                  key={palette.key}
                  onPress={() => {
                    if (!canEdit) return;
                    setTextColor(palette.primary);
                    setTextSecondaryColor(palette.secondary);
                  }}
                  style={[
                    styles.paletteBtn,
                    {
                      borderColor: isActive ? t.brand : t.overlayBorder,
                      backgroundColor: isActive ? hexToRgba(t.brand, 0.12) : t.boxBg,
                    },
                  ]}
                >
                  <View style={styles.paletteSwatches}>
                    <View style={[styles.paletteDot, { backgroundColor: palette.primary, borderColor: t.overlayBorder }]} />
                    <View style={[styles.paletteDot, { backgroundColor: palette.secondary, borderColor: t.overlayBorder }]} />
                  </View>
                  <Text style={[styles.paletteLabel, { color: isActive ? t.brand : t.subText }]}>{palette.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            onPress={() => {
              if (!canEdit) return;
              setTextColor('');
              setTextSecondaryColor('');
            }}
            style={[
              styles.paletteBtn,
              {
                marginTop: 10,
                borderColor: t.overlayBorder,
                backgroundColor: t.boxBg,
                alignSelf: 'flex-start',
              },
            ]}
          >
            <Text style={[styles.paletteLabel, { color: t.subText }]}>Limpiar override de textos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Texto principal (títulos y cuerpo)</Text>
          <Text style={styles.hint}>Opcional. #RRGGBB. Vacío = el preset elige.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TEXT_QUICK_GYM.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => canEdit && setTextColor(c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: c,
                    borderWidth: validTextColor?.toLowerCase() === c.toLowerCase() ? 3 : 1,
                    borderColor: validTextColor?.toLowerCase() === c.toLowerCase() ? t.brand : t.overlayBorder,
                  }}
                />
              ))}
            </View>
          </ScrollView>
          <TextInput
            style={styles.input}
            value={textColor}
            onChangeText={setTextColor}
            placeholder="#f8fafc u omitir"
            placeholderTextColor={t.placeholder}
            editable={canEdit}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Texto secundario (subtítulos, ayudas, placeholders)</Text>
          <Text style={styles.hint}>
            Opcional. Elegí un color que contraste bien con el principal; si lo dejás vacío y definiste principal, se
            suaviza desde el principal; si no, usa el preset.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TEXT_SECOND_QUICK_GYM.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => canEdit && setTextSecondaryColor(c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: c,
                    borderWidth: validTextSecondary?.toLowerCase() === c.toLowerCase() ? 3 : 1,
                    borderColor: validTextSecondary?.toLowerCase() === c.toLowerCase() ? t.brand : t.overlayBorder,
                  }}
                />
              ))}
            </View>
          </ScrollView>
          <TextInput
            style={styles.input}
            value={textSecondaryColor}
            onChangeText={setTextSecondaryColor}
            placeholder="#94a3b8 u omitir"
            placeholderTextColor={t.placeholder}
            editable={canEdit}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Tipo de fondo (#20b)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['solid', 'gradient', 'image'].map((bt) => (
              <TouchableOpacity
                key={bt}
                onPress={() => canEdit && setBackgroundType(bt)}
                style={[
                  { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: t.overlayBorder },
                  backgroundType === bt && { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.15) },
                ]}
              >
                <Text style={{ color: backgroundType === bt ? t.brand : t.subText, fontSize: 13 }}>{bt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {backgroundType === 'image' && (
            <>
              <Text style={styles.hint}>
                Si la foto es muy clara, la app aplica un velo oscuro para que títulos y textos sigan legibles.
              </Text>
              <View style={styles.bgPreviewWrap}>
                {backgroundLocalUri || backgroundUrl ? (
                  <Image source={{ uri: backgroundLocalUri || backgroundUrl }} style={styles.bgPreviewImg} resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={38} color={t.placeholder} />
                )}
              </View>
              {canEdit && (
                <TouchableOpacity
                  style={[styles.logoBtn, styles.logoBtnSpaced]}
                  onPress={pickAndUploadBackground}
                  disabled={uploadingBackground || saving}
                >
                  {uploadingBackground ? (
                    <ActivityIndicator size="small" color={t.brand} />
                  ) : (
                    <Text style={styles.logoBtnText}>Elegir imagen de fondo</Text>
                  )}
                </TouchableOpacity>
              )}
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                value={backgroundUrl}
                onChangeText={setBackgroundUrl}
                placeholder="...o URL de imagen (opcional)"
                placeholderTextColor={t.placeholder}
                editable={canEdit}
              />
            </>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Logo</Text>
          <View style={styles.logoWrap}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImg} resizeMode="cover" />
            ) : (
              <Ionicons name="business" size={40} color={t.placeholder} />
            )}
          </View>
          {canEdit && (
            <TouchableOpacity style={styles.logoBtn} onPress={pickAndUploadLogo} disabled={uploadingLogo}>
              {uploadingLogo ? (
                <ActivityIndicator size="small" color={t.brand} />
              ) : (
                <Text style={styles.logoBtnText}>Cambiar logo</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.saveBtn, !canEdit && { opacity: 0.55 }]} onPress={save} disabled={saving || !canEdit} activeOpacity={0.9}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{canEdit ? 'Guardar cambios' : 'Sin permisos para guardar'}</Text>
          )}
        </TouchableOpacity>

        {!canEdit && (
          <Text style={styles.hint}>Solo el dueño de la organización puede editar esta configuración.</Text>
        )}

        {/* Footer atribución: logo completo (triangulo + texto) */}
        <View style={{ alignItems: 'center', marginTop: 32, paddingVertical: 20 }}>
          <LogoCompleto height={30} style={{ marginBottom: 6 }} />
          <Text style={[styles.hint, { fontSize: 11, opacity: 0.8 }]}>FitEngine by WAITOMO © 2026</Text>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
