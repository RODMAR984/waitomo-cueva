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
  Share,
  Switch,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { supabase } from '../supabaseClient';
import { getThemeTokens } from '../theme/colors';
import { imageUriToArrayBuffer } from '../utils/imageUriToArrayBuffer';
import LogoCompleto from '../components/LogoCompleto';
import * as Clipboard from 'expo-clipboard';
import { generateClientInviteCode } from '../utils/clientInviteCode';
import { buildClientInvitePublicLink } from '../utils/fitengineUrls';
import { FULL_HEX_CHOICE_GYM } from '../utils/gymColorPalette';

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


const TEXT_PALETTES_GYM = [
  { key: 'neon', labelKey: 'gym_palette_neon', primary: '#e2e8f0', secondary: '#22d3ee' },
  { key: 'minimal', labelKey: 'gym_palette_minimal', primary: '#f8fafc', secondary: '#a1a1aa' },
  { key: 'clean', labelKey: 'gym_palette_clean', primary: '#0f172a', secondary: '#475569' },
  { key: 'warm', labelKey: 'gym_palette_warm', primary: '#431407', secondary: '#9a3412' },
  { key: 'rose', labelKey: 'gym_palette_rose', primary: '#fce7f3', secondary: '#be185d' },
  { key: 'forest', labelKey: 'gym_palette_forest', primary: '#ecfccb', secondary: '#166534' },
  { key: 'gold', labelKey: 'gym_palette_gold', primary: '#fef08a', secondary: '#a16207' },
  { key: 'ocean', labelKey: 'gym_palette_ocean', primary: '#93c5fd', secondary: '#0369a1' },
  { key: 'studio', labelKey: 'gym_palette_studio', primary: '#fafafa', secondary: '#71717a' },
  { key: 'lavender', labelKey: 'gym_palette_lavender', primary: '#ede9fe', secondary: '#6d28d9' },
  { key: 'slate', labelKey: 'gym_palette_slate', primary: '#e2e8f0', secondary: '#475569' },
  { key: 'coral', labelKey: 'gym_palette_coral', primary: '#fff7ed', secondary: '#ea580c' },
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
  const { t: tStr } = useLocale();
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
  const [surfaceColor, setSurfaceColor] = useState(organization?.features?.ui_surface_color || '');
  const [borderColor, setBorderColor] = useState(organization?.features?.ui_border_color || '');
  const [overlayColor, setOverlayColor] = useState(organization?.features?.ui_overlay_color || '');
  const [clientWelcomeMessage, setClientWelcomeMessage] = useState(
    organization?.features?.client_welcome_message || ''
  );
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  /** Si true, clientes no pueden forzar claro/oscuro en Config: sigue el preset del gym. */
  const [lockClientTheme, setLockClientTheme] = useState(
    !!organization?.features?.lock_client_theme,
  );
  /** Paleta completa plegada por defecto (menos invasiva). */
  const [paletteOpenKey, setPaletteOpenKey] = useState(null);

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
      setSurfaceColor(organization.features?.ui_surface_color || '');
      setBorderColor(organization.features?.ui_border_color || '');
      setOverlayColor(organization.features?.ui_overlay_color || '');
      setClientWelcomeMessage(organization.features?.client_welcome_message || '');
      setLockClientTheme(!!organization.features?.lock_client_theme);
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
  const validSurfaceColor = HEX_TEXT_COLOR.test((surfaceColor || '').trim()) ? surfaceColor.trim() : null;
  const validBorderColor = HEX_TEXT_COLOR.test((borderColor || '').trim()) ? borderColor.trim() : null;
  const validOverlayColor = HEX_TEXT_COLOR.test((overlayColor || '').trim()) ? overlayColor.trim() : null;
  const previewOrg = useMemo(() => {
    const feats = {};
    if (validTextColor) feats.text_color = validTextColor;
    if (validTextSecondary) feats.text_secondary_color = validTextSecondary;
    if (validSurfaceColor) feats.ui_surface_color = validSurfaceColor;
    if (validBorderColor) feats.ui_border_color = validBorderColor;
    if (validOverlayColor) feats.ui_overlay_color = validOverlayColor;
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
    validSurfaceColor,
    validBorderColor,
    validOverlayColor,
  ]);
  const previewTokensCurrent = useMemo(
    () => getThemeTokens(getEffectiveMode(mode), previewOrg),
    [mode, previewOrg]
  );
  const previewTokensDark = useMemo(() => getThemeTokens('dark', previewOrg), [previewOrg]);
  const previewTokensLight = useMemo(() => getThemeTokens('light', previewOrg), [previewOrg]);

  const pickAndUploadLogo = async () => {
    if (!orgId) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('gym_config_err_no_org'));
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(tStr('gym_config_perm_title'), tStr('gym_config_perm_gallery_logo'));
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
        tStr('gym_config_logo_title'),
        e?.message?.includes('Bucket') ? tStr('gym_config_logo_bucket_hint') : (e?.message || tStr('gym_config_logo_upload_fail')),
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const pickAndUploadBackground = async () => {
    if (!orgId) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('gym_config_err_no_org'));
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(tStr('gym_config_perm_title'), tStr('gym_config_perm_gallery_bg'));
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
      Alert.alert(tStr('gym_config_bg_title'), e?.message || tStr('gym_config_bg_upload_fail'));
    } finally {
      setUploadingBackground(false);
    }
  };

  const save = async () => {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      Alert.alert(tStr('gym_config_name_title'), tStr('gym_config_name_required'));
      return;
    }
    if (!orgId) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('gym_config_err_no_org'));
      return;
    }
    if (!canEdit) {
      Alert.alert(tStr('gym_config_no_permission_title'), tStr('gym_config_no_permission_body'));
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
      if (validSurfaceColor) prevFeatures.ui_surface_color = validSurfaceColor;
      else delete prevFeatures.ui_surface_color;
      if (validBorderColor) prevFeatures.ui_border_color = validBorderColor;
      else delete prevFeatures.ui_border_color;
      if (validOverlayColor) prevFeatures.ui_overlay_color = validOverlayColor;
      else delete prevFeatures.ui_overlay_color;

      const welcomeTrim = (clientWelcomeMessage || '').trim();
      if (welcomeTrim) prevFeatures.client_welcome_message = welcomeTrim;
      else delete prevFeatures.client_welcome_message;

      if (lockClientTheme) prevFeatures.lock_client_theme = true;
      else delete prevFeatures.lock_client_theme;

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
      Alert.alert(tStr('gym_config_saved_title'), tStr('gym_config_saved_body'));
      navigation.goBack();
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('gym_config_save_fail'));
    } finally {
      setSaving(false);
    }
  };

  const applyFitEngineDefaults = useCallback(async () => {
    if (!canEdit || !orgId) return;
    setAccentColor('#00dddd');
    setThemePreset('dark_vivid');
    setTextColor('');
    setTextSecondaryColor('');
    setSurfaceColor('');
    setBorderColor('');
    setOverlayColor('');
    setSaving(true);
    try {
      const prevFeatures =
        organization?.features && typeof organization.features === 'object' && !Array.isArray(organization.features)
          ? { ...organization.features }
          : {};
      delete prevFeatures.text_color;
      delete prevFeatures.text_secondary_color;
      delete prevFeatures.ui_surface_color;
      delete prevFeatures.ui_border_color;
      delete prevFeatures.ui_overlay_color;
      const welcomeTrim = (clientWelcomeMessage || '').trim();
      if (welcomeTrim) prevFeatures.client_welcome_message = welcomeTrim;
      else delete prevFeatures.client_welcome_message;
      if (lockClientTheme) prevFeatures.lock_client_theme = true;
      else delete prevFeatures.lock_client_theme;

      const { error } = await supabase
        .from('organizations')
        .update({
          accent_color: '#00dddd',
          theme_preset: 'dark_vivid',
          features: prevFeatures,
        })
        .eq('id', orgId);
      if (error) throw error;
      if (typeof refreshOrganization === 'function') await refreshOrganization(orgId);
      Alert.alert(tStr('gym_reset_fitengine_applied_title'), tStr('gym_reset_fitengine_applied_body'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('gym_config_save_fail'));
    } finally {
      setSaving(false);
    }
  }, [
    canEdit,
    orgId,
    organization?.features,
    clientWelcomeMessage,
    lockClientTheme,
    refreshOrganization,
    tStr,
  ]);

  const ensureOrRotateInviteCode = useCallback(async () => {
    if (!orgId || !canEdit) return;
    setInviteBusy(true);
    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const next = generateClientInviteCode();
        const { error } = await supabase
          .from('organizations')
          .update({ client_invite_code: next })
          .eq('id', orgId);
        if (!error) {
          if (typeof refreshOrganization === 'function') await refreshOrganization(orgId);
          Alert.alert(tStr('gym_config_invite_ready_title'), tStr('gym_config_invite_ready_body'));
          return;
        }
        const msg = String(error.message || '');
        if (!msg.toLowerCase().includes('duplicate') && error.code !== '23505') {
          throw error;
        }
      }
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('gym_config_invite_unique_fail'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('gym_config_save_fail'));
    } finally {
      setInviteBusy(false);
    }
  }, [orgId, canEdit, refreshOrganization, tStr]);

  const copyInviteCodeOnly = useCallback(async () => {
    const c = String(organization?.client_invite_code || '').trim();
    if (!c) {
      Alert.alert(tStr('gym_config_invites_title'), tStr('gym_config_invites_need_code'));
      return;
    }
    try {
      await Clipboard.setStringAsync(c);
      Alert.alert(
        tStr('gym_config_copied_title'),
        tStr('gym_config_copy_code_help'),
      );
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('gym_config_copy_fail'));
    }
  }, [organization?.client_invite_code, tStr]);

  const copyInviteDeepLink = useCallback(async () => {
    const c = String(organization?.client_invite_code || '').trim();
    if (!c) {
      Alert.alert(tStr('gym_config_invites_title'), tStr('gym_config_invites_need_code'));
      return;
    }
    const url = buildClientInvitePublicLink(c);
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert(
        tStr('gym_config_copied_title'),
        tStr('gym_config_copy_link_help'),
      );
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('gym_config_copy_fail'));
    }
  }, [organization?.client_invite_code, tStr]);

  const shareInviteMessage = useCallback(async () => {
    const c = String(organization?.client_invite_code || '').trim();
    if (!c) {
      Alert.alert(tStr('gym_config_invites_title'), tStr('gym_config_invites_need_code'));
      return;
    }
    const gym = String((name || organization?.name || 'tu gym')).trim();
    const message = tStr('gym_invite_share_message').replace('{{gym}}', gym).replace('{{code}}', c);
    try {
      await Share.share({ message, title: 'FitEngine' });
    } catch (e) {
      if (e?.message !== 'User did not share') {
        Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('gym_config_share_fail'));
      }
    }
  }, [organization?.client_invite_code, name, organization?.name, tStr]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, padding: 20, paddingTop: 56 },
        header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
        backBtn: { padding: 8, marginLeft: -8 },
        title: { color: t.text, fontSize: 22, fontWeight: '800', marginLeft: 8 },
        scroll: { paddingBottom: 40 },
        sectionHeading: { color: t.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
        sectionIntro: { color: t.subText, fontSize: 13, lineHeight: 19, marginBottom: 18 },
        subHeading: { color: t.text, fontSize: 15, fontWeight: '800', marginBottom: 10 },
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
        liveSimBlock: {
          borderRadius: 14,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          padding: 12,
          marginBottom: 6,
        },
        liveLegendWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 8 },
        liveLegendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          marginRight: 10,
          marginBottom: 8,
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderRadius: 8,
          backgroundColor: hexToRgba(t.brand, 0.06),
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        liveLegendDot: { width: 14, height: 14, borderRadius: 7, marginRight: 6, borderWidth: 1, borderColor: 'rgba(148,163,184,0.5)' },
        liveLegendLabel: { color: t.subText, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
        liveLegendPreset: { color: t.text, fontSize: 11, fontWeight: '700', maxWidth: 100 },
        paletteRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, width: '100%' },
        paletteBtn: {
          borderWidth: 1,
          borderRadius: 10,
          paddingVertical: 9,
          paddingHorizontal: 10,
          minWidth: 92,
          marginRight: 8,
          marginBottom: 8,
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
        colorGridScroll: { maxHeight: 280, marginTop: 8 },
        colorGridWrap: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', paddingBottom: 8 },
        colorGridChip: { width: 28, height: 28, borderRadius: 6, margin: 3, borderWidth: 1 },
        paletteToggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 11,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
          marginTop: 8,
        },
        paletteToggleLabel: { flex: 1, marginLeft: 8, color: t.text, fontSize: 14, fontWeight: '700' },
        paletteToggleHint: { color: t.placeholder, fontSize: 12, marginRight: 8 },
        palettePreviewSwatch: {
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
      }),
    [t]
  );

  const renderFullColorGrid = useCallback(
    (val, setVal) => (
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={styles.colorGridScroll}
        contentContainerStyle={styles.colorGridWrap}
      >
        {FULL_HEX_CHOICE_GYM.map((c) => {
          const active = String(val || '').toLowerCase().trim() === c.toLowerCase();
          return (
            <TouchableOpacity
              key={c}
              disabled={!canEdit}
              onPress={() => canEdit && setVal(c)}
              activeOpacity={0.88}
              style={[
                styles.colorGridChip,
                { backgroundColor: c },
                {
                  borderColor: active ? t.brand : 'rgba(148,163,184,0.55)',
                  borderWidth: active ? 3 : 1,
                },
              ]}
            />
          );
        })}
      </ScrollView>
    ),
    [canEdit, styles, t.brand],
  );

  const renderCollapsiblePalette = useCallback(
    (key, val, setVal, title) => {
      const open = paletteOpenKey === key;
      const trimmed = (val || '').trim();
      const showSwatch = HEX_TEXT_COLOR.test(trimmed);
      return (
        <View>
          <TouchableOpacity
            style={styles.paletteToggleRow}
            onPress={() => setPaletteOpenKey((prev) => (prev === key ? null : key))}
            disabled={!canEdit}
            activeOpacity={0.85}
          >
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={t.subText} />
            <Text style={styles.paletteToggleLabel}>{title}</Text>
            <Text style={styles.paletteToggleHint}>
              {open
                ? tStr('gym_palette_toggle_hide')
                : tStr('gym_palette_toggle_count').replace('{{count}}', String(FULL_HEX_CHOICE_GYM.length))}
            </Text>
            {showSwatch ? (
              <View style={[styles.palettePreviewSwatch, { backgroundColor: trimmed }]} />
            ) : (
              <View style={{ width: 22 }} />
            )}
          </TouchableOpacity>
          {open ? renderFullColorGrid(val, setVal) : null}
        </View>
      );
    },
    [paletteOpenKey, canEdit, renderFullColorGrid, styles, t.subText, tStr],
  );
  const getColorInputTextStyle = useCallback(
    (value) => {
      const normalized = String(value || '').trim();
      if (!HEX_TEXT_COLOR.test(normalized)) return null;
      return { color: normalized, fontWeight: '700' };
    },
    [],
  );

  if (!orgId) {
    return (
      <BackgroundWrapper screen="gymconfig">
        <View style={styles.screen}>
          <Text style={styles.title}>{tStr('gym_config_loading')}</Text>
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper screen="gymconfig">
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={26} color={t.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{tStr('gym_config_screen_title')}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{tStr('gym_config_org_name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={tStr('gym_config_org_name_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{tStr('gym_config_welcome_label')}</Text>
          <Text style={styles.hint}>
            {tStr('gym_config_welcome_hint')}
          </Text>
          <TextInput
            style={[styles.input, { minHeight: 88, textAlignVertical: 'top' }]}
            value={clientWelcomeMessage}
            onChangeText={setClientWelcomeMessage}
            placeholder={tStr('gym_config_welcome_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
            multiline
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{tStr('gym_config_invites_new')}</Text>
          <Text style={styles.hint}>
            {tStr('gym_invite_hint_long')}
          </Text>
          <Text style={[styles.input, { fontWeight: '700', letterSpacing: 1 }]}>
            {organization?.client_invite_code ? String(organization.client_invite_code).trim() : tStr('gym_config_no_code_placeholder')}
          </Text>
          {canEdit ? (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.logoBtn, { marginTop: 0 }]}
                  onPress={ensureOrRotateInviteCode}
                  disabled={inviteBusy || saving}
                  activeOpacity={0.85}
                >
                  {inviteBusy ? (
                    <ActivityIndicator size="small" color={t.brand} />
                  ) : (
                    <Text style={styles.logoBtnText}>
                      {organization?.client_invite_code ? tStr('gym_config_regenerate_code') : tStr('gym_config_generate_code')}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logoBtn, { marginTop: 0 }]}
                  onPress={copyInviteCodeOnly}
                  disabled={!organization?.client_invite_code}
                  activeOpacity={0.85}
                >
                  <Text style={styles.logoBtnText}>{tStr('gym_invite_copy_code')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logoBtn, { marginTop: 0 }]}
                  onPress={shareInviteMessage}
                  disabled={!organization?.client_invite_code}
                  activeOpacity={0.85}
                >
                  <Text style={styles.logoBtnText}>{tStr('gym_invite_share')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logoBtn, { marginTop: 0 }]}
                  onPress={copyInviteDeepLink}
                  disabled={!organization?.client_invite_code}
                  activeOpacity={0.85}
                >
                  <Text style={styles.logoBtnText}>{tStr('gym_invite_copy_link')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ marginBottom: 6 }}>
          <Text style={styles.sectionHeading}>{tStr('gym_config_section_ui')}</Text>
          <Text style={styles.sectionIntro}>
            {tStr('gym_config_section_ui_intro')}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.subHeading}>{tStr('gym_config_preset_heading')}</Text>
          <Text style={styles.hint}>
            {tStr('gym_config_preset_hint')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {['dark_vivid', 'dark_minimal', 'light_clean', 'light_warm'].map((preset) => (
              <TouchableOpacity
                key={preset}
                onPress={() => canEdit && setThemePreset(preset)}
                style={[
                  { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: t.overlayBorder, marginRight: 8, marginBottom: 8 },
                  themePreset === preset && { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.15) },
                ]}
              >
                <Text style={{ color: themePreset === preset ? t.brand : t.subText, fontSize: 13, fontWeight: '700' }}>
                  {tStr(`gym_preset_${preset}`) || preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>{tStr(`gym_preset_hint_${themePreset}`) || ''}</Text>
          <Text style={styles.hint}>{tStr('gym_config_theme_global_hint')}</Text>
          {canEdit ? (
            <TouchableOpacity
              style={[styles.logoBtn, { marginTop: 12, alignSelf: 'flex-start', opacity: saving ? 0.6 : 1 }]}
              onPress={() => applyFitEngineDefaults()}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color={t.brand} />
              ) : (
                <Text style={styles.logoBtnText}>{tStr('gym_reset_fitengine_cta')}</Text>
              )}
            </TouchableOpacity>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              paddingVertical: 8,
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.subHeading}>{tStr('gym_lock_client_theme_title')}</Text>
              <Text style={styles.hint}>{tStr('gym_lock_client_theme_hint')}</Text>
            </View>
            <Switch
              value={lockClientTheme}
              onValueChange={canEdit ? setLockClientTheme : undefined}
              disabled={!canEdit}
              trackColor={{ false: t.overlayBorder, true: t.brand }}
              thumbColor="#f4ffff"
            />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.subHeading}>{tStr('gym_config_accent_heading')}</Text>
          <Text style={styles.hint}>{tStr('gym_config_accent_hint')}</Text>
          <Text style={styles.label}>{tStr('gym_config_hex_label')}</Text>
          <TextInput
            style={[styles.input, getColorInputTextStyle(accentColor)]}
            value={accentColor}
            onChangeText={setAccentColor}
            placeholder="#00dddd"
            placeholderTextColor={t.placeholder}
            editable={canEdit}
          />
          {renderCollapsiblePalette('accent', accentColor, setAccentColor, tStr('gym_palette_title_accent'))}
        </View>

        <View style={styles.liveSimBlock}>
          <Text style={[styles.subHeading, { marginBottom: 4 }]}>{tStr('gym_live_title')}</Text>
          <Text style={[styles.hint, { marginBottom: 0 }]}>
            {tStr('gym_live_hint').replace('{{mode}}', String(getEffectiveMode(mode)))}
          </Text>
          <View style={styles.liveLegendWrap}>
            <View style={styles.liveLegendItem}>
              <Text style={styles.liveLegendLabel}>{tStr('gym_legend_style')}</Text>
              <Text style={styles.liveLegendPreset} numberOfLines={1}>
                {tStr(`gym_preset_${themePreset}`) || themePreset}
              </Text>
            </View>
            <View style={styles.liveLegendItem}>
              <View
                style={[
                  styles.liveLegendDot,
                  { backgroundColor: String(accentColor || '').trim() || previewTokensCurrent.brand },
                ]}
              />
              <Text style={styles.liveLegendLabel}>{tStr('gym_legend_accent')}</Text>
            </View>
            <View style={styles.liveLegendItem}>
              <View style={[styles.liveLegendDot, { backgroundColor: previewTokensCurrent.text }]} />
              <Text style={styles.liveLegendLabel}>{tStr('gym_legend_text')}</Text>
            </View>
            <View style={styles.liveLegendItem}>
              <View style={[styles.liveLegendDot, { backgroundColor: previewTokensCurrent.subText }]} />
              <Text style={styles.liveLegendLabel}>{tStr('gym_legend_secondary_short')}</Text>
            </View>
            <View style={styles.liveLegendItem}>
              <View style={[styles.liveLegendDot, { backgroundColor: previewTokensCurrent.boxBg }]} />
              <Text style={styles.liveLegendLabel}>{tStr('gym_legend_surface')}</Text>
            </View>
            <View style={styles.liveLegendItem}>
              <View
                style={[
                  styles.liveLegendDot,
                  {
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderColor: previewTokensCurrent.overlayBorder,
                  },
                ]}
              />
              <Text style={styles.liveLegendLabel}>{tStr('gym_legend_border')}</Text>
            </View>
            <View style={styles.liveLegendItem}>
              <View
                style={[
                  styles.liveLegendDot,
                  {
                    width: 22,
                    borderRadius: 4,
                    backgroundColor: previewTokensCurrent.screenOverlay,
                    borderWidth: 1,
                    borderColor: 'rgba(148,163,184,0.4)',
                  },
                ]}
              />
              <Text style={styles.liveLegendLabel}>{tStr('gym_legend_overlay')}</Text>
            </View>
          </View>
          {[{ key: 'dark', labelKey: 'gym_preview_dark', token: previewTokensDark }, { key: 'light', labelKey: 'gym_preview_light', token: previewTokensLight }].map(({ key, labelKey, token }) => (
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
              <Text style={[styles.previewTitle, { color: token.text }]}>{tStr(labelKey)}</Text>
              <Text style={{ color: token.text, fontSize: 16, fontWeight: '800', marginBottom: 3 }}>
                {tStr('gym_preview_main_title')}
              </Text>
              <Text style={{ color: token.subText, fontSize: 13, marginBottom: 10 }}>
                {tStr('gym_preview_secondary_line')}
              </Text>
              <View style={styles.previewRow}>
                <View
                  style={[
                    styles.previewBadge,
                    { backgroundColor: token.buttonPrimary.backgroundColor, borderColor: token.buttonPrimary.borderColor },
                  ]}
                >
                  <Text style={[styles.previewBadgeText, { color: token.buttonPrimaryText.color }]}>{tStr('gym_preview_action')}</Text>
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
                  <Text style={{ color: token.subText, fontSize: 11 }}>{tStr('gym_preview_card')}</Text>
                </View>
              </View>
            </View>
          ))}
          <Text style={styles.hint}>
            {tStr('gym_preview_mode_line')
              .replace('{{mode}}', String(getEffectiveMode(mode)))
              .replace('{{text}}', String(previewTokensCurrent.text))
              .replace('{{sub}}', String(previewTokensCurrent.subText))
              .replace(
                '{{surface}}',
                validSurfaceColor ? tStr('gym_preview_suffix_surface').replace('{{c}}', validSurfaceColor) : '',
              )
              .replace(
                '{{border}}',
                validBorderColor ? tStr('gym_preview_suffix_border').replace('{{c}}', validBorderColor) : '',
              )
              .replace(
                '{{overlay}}',
                validOverlayColor ? tStr('gym_preview_suffix_overlay').replace('{{c}}', validOverlayColor) : '',
              )}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.subHeading}>{tStr('gym_config_text_heading')}</Text>
          <Text style={styles.hint}>
            {tStr('gym_config_text_intro')}
          </Text>
          <Text style={styles.label}>{tStr('gym_config_quick_palettes')}</Text>
          <Text style={styles.hint}>{tStr('gym_config_quick_palettes_hint')}</Text>
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
                  <Text style={[styles.paletteLabel, { color: isActive ? t.brand : t.subText }]}>{tStr(palette.labelKey)}</Text>
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
            <Text style={[styles.paletteLabel, { color: t.subText }]}>{tStr('gym_config_clear_text')}</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 16 }]}>{tStr('gym_config_text_primary_label')}</Text>
          <Text style={styles.hint}>{tStr('gym_config_text_primary_hint')}</Text>
          {renderCollapsiblePalette('textPrimary', textColor, setTextColor, tStr('gym_palette_title_text_primary'))}
          <TextInput
            style={[styles.input, getColorInputTextStyle(textColor)]}
            value={textColor}
            onChangeText={setTextColor}
            placeholder={tStr('gym_config_text_primary_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>{tStr('gym_config_text_secondary_label')}</Text>
          <Text style={styles.hint}>
            {tStr('gym_config_text_secondary_hint')}
          </Text>
          {renderCollapsiblePalette('textSecondary', textSecondaryColor, setTextSecondaryColor, tStr('gym_palette_title_text_secondary'))}
          <TextInput
            style={[styles.input, getColorInputTextStyle(textSecondaryColor)]}
            value={textSecondaryColor}
            onChangeText={setTextSecondaryColor}
            placeholder={tStr('gym_config_text_secondary_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.subHeading}>{tStr('gym_config_surface_heading')}</Text>
          <Text style={styles.hint}>
            {tStr('gym_config_surface_intro')}
          </Text>
          <Text style={styles.label}>{tStr('gym_config_surface_label')}</Text>
          <TextInput
            style={[styles.input, getColorInputTextStyle(surfaceColor)]}
            value={surfaceColor}
            onChangeText={setSurfaceColor}
            placeholder={tStr('gym_config_surface_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
          />
          {renderCollapsiblePalette('surface', surfaceColor, setSurfaceColor, tStr('gym_palette_title_surface'))}
          <Text style={[styles.label, { marginTop: 12 }]}>{tStr('gym_config_border_label')}</Text>
          <TextInput
            style={[styles.input, getColorInputTextStyle(borderColor)]}
            value={borderColor}
            onChangeText={setBorderColor}
            placeholder={tStr('gym_config_border_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
          />
          {renderCollapsiblePalette('border', borderColor, setBorderColor, tStr('gym_palette_title_border'))}
          <TouchableOpacity
            onPress={() => {
              if (!canEdit) return;
              setSurfaceColor('');
              setBorderColor('');
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
            <Text style={[styles.paletteLabel, { color: t.subText }]}>{tStr('gym_config_clear_surface')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.block}>
          <Text style={styles.subHeading}>{tStr('gym_config_overlay_heading')}</Text>
          <Text style={styles.hint}>
            {tStr('gym_config_overlay_intro')}
          </Text>
          <Text style={styles.label}>{tStr('gym_config_overlay_label')}</Text>
          <TextInput
            style={[styles.input, getColorInputTextStyle(overlayColor)]}
            value={overlayColor}
            onChangeText={setOverlayColor}
            placeholder={tStr('gym_config_overlay_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
          />
          {renderCollapsiblePalette('overlay', overlayColor, setOverlayColor, tStr('gym_palette_title_overlay'))}
          <TouchableOpacity
            onPress={() => {
              if (!canEdit) return;
              setOverlayColor('');
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
            <Text style={[styles.paletteLabel, { color: t.subText }]}>{tStr('gym_config_clear_overlay')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{tStr('gym_config_bg_type_label')}</Text>
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
                <Text style={{ color: backgroundType === bt ? t.brand : t.subText, fontSize: 13 }}>{tStr(`gym_bg_type_${bt}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {backgroundType === 'image' && (
            <>
              <Text style={styles.hint}>
                {tStr('gym_config_bg_image_hint')}
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
                    <Text style={styles.logoBtnText}>{tStr('gym_config_pick_bg_image')}</Text>
                  )}
                </TouchableOpacity>
              )}
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                value={backgroundUrl}
                onChangeText={setBackgroundUrl}
                placeholder={tStr('gym_config_bg_url_ph')}
                placeholderTextColor={t.placeholder}
                editable={canEdit}
              />
            </>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{tStr('gym_config_logo_section')}</Text>
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
                <Text style={styles.logoBtnText}>{tStr('gym_config_change_logo')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.saveBtn, !canEdit && { opacity: 0.55 }]} onPress={save} disabled={saving || !canEdit} activeOpacity={0.9}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{canEdit ? tStr('gym_config_save') : tStr('gym_config_save_denied')}</Text>
          )}
        </TouchableOpacity>

        {!canEdit && (
          <Text style={styles.hint}>{tStr('gym_config_owner_only_hint')}</Text>
        )}

        {/* Footer atribución: logo completo (triangulo + texto) */}
        <View style={{ alignItems: 'center', marginTop: 32, paddingVertical: 20 }}>
          <LogoCompleto height={30} style={{ marginBottom: 6 }} />
          <Text style={[styles.hint, { fontSize: 11, opacity: 0.8 }]}>{tStr('gym_config_footer')}</Text>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
