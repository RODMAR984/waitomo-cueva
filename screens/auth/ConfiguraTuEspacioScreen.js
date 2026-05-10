// ConfiguraTuEspacioScreen — FitEngine: preview en vivo (acento, preset, fondo, logo). Sin colores Waitomo en este panel.
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackNavButton from '../../components/BackNavButton';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import { supabase } from '../../supabaseClient';
import { getThemeTokens, hexToRgba } from '../../theme/colors';
import { imageUriToArrayBuffer } from '../../utils/imageUriToArrayBuffer';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

const BUCKET_ORG_LOGOS = 'org-logos';
const BUCKET_ORG_BACKGROUNDS = 'org-backgrounds';
const HEX_RE = /^#([0-9A-F]{6})$/i;

/** UI del panel: slate / índigo (no Waitomo cian). */
const FE = {
  bg: '#0c1220',
  panel: 'rgba(99, 102, 241, 0.08)',
  panelBorder: 'rgba(129, 140, 248, 0.35)',
  text: '#e8eaf0',
  sub: '#94a3b8',
  inputBg: 'rgba(15, 23, 42, 0.85)',
  inputBorder: 'rgba(148, 163, 184, 0.35)',
  muted: '#64748b',
};

const hslToHex = (h, s = 85, l = 50) => {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const HUES = Array.from({ length: 36 }, (_, i) => hslToHex(i * 10));
const LIGHT_STEPS = [28, 36, 44, 52, 60, 68, 76];

const hexToRgb = (hex) => {
  const clean = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
};

const applyLightness = (hex, lightness = 50) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#818cf8';
  const f = Math.max(0, Math.min(100, lightness)) / 50;
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${ch(rgb.r).toString(16).padStart(2, '0')}${ch(rgb.g).toString(16).padStart(2, '0')}${ch(rgb.b).toString(16).padStart(2, '0')}`;
};

/** Atajos de color de fuente (opcional; pisá el del preset) */
const TEXT_QUICK = ['#f8fafc', '#e2e8f0', '#fef08a', '#0f172a', '#431407', '#fce7f3', '#ecfccb'];

const TEXT_SECOND_QUICK = ['#94a3b8', '#64748b', '#a8a29e', '#78716c', '#0ea5e9', '#9a3412', '#4b5563'];

function isStorageBucketMissingError(err) {
  const msg = String(err?.message || err || '');
  return /bucket not found/i.test(msg);
}

export default function ConfiguraTuEspacioScreen() {
  const navigation = useNavigation();
  const { t: tStr } = useLocale();
  const { user, refreshOrganization, refreshProfile } = useAuth() || {};

  const presetLabel = (k) => tStr(`fe_preset_${k}`);
  const presetHint = (k) => tStr(`fe_preset_hint_${k}`);
  const bgTypeLabel = (k) => tStr(`fe_bg_${k}`);
  const [name, setName] = useState('');
  const [type, setType] = useState('gym');
  const [accentColor, setAccentColor] = useState('#818cf8');
  const [textColor, setTextColor] = useState('');
  const [textSecondaryColor, setTextSecondaryColor] = useState('');
  const [themePreset, setThemePreset] = useState('dark_vivid');
  const [backgroundType, setBackgroundType] = useState('solid');
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [backgroundLocalUri, setBackgroundLocalUri] = useState(null);
  const [pickingBackground, setPickingBackground] = useState(false);
  const [logoLocalUri, setLogoLocalUri] = useState(null);
  const [pickingLogo, setPickingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  const validAccent = HEX_RE.test((accentColor || '').trim()) ? accentColor.trim() : '#818cf8';
  const validTextColor = HEX_RE.test((textColor || '').trim()) ? textColor.trim() : null;
  const validTextSecondary = HEX_RE.test((textSecondaryColor || '').trim()) ? textSecondaryColor.trim() : null;
  const previewMode = themePreset.startsWith('light_') ? 'light' : 'dark';

  const resolvedImageUri =
    backgroundType === 'image'
      ? backgroundLocalUri || (backgroundUrl || '').trim() || null
      : null;

  const previewOrg = useMemo(() => {
    const feats = {};
    if (validTextColor) feats.text_color = validTextColor;
    if (validTextSecondary) feats.text_secondary_color = validTextSecondary;
    return {
      id: 'preview-fitengine-local',
      name: tStr('fe_preview_org_name'),
      accent_color: validAccent,
      theme_preset: themePreset,
      features: Object.keys(feats).length ? feats : undefined,
      background_type: backgroundType,
      background_url: backgroundType === 'image' ? resolvedImageUri : null,
    };
  }, [validAccent, validTextColor, validTextSecondary, themePreset, backgroundType, resolvedImageUri, tStr]);

  const previewTokens = useMemo(
    () => getThemeTokens(previewMode, previewOrg),
    [previewMode, previewOrg],
  );

  const previewWidth = Math.min(Dimensions.get('window').width - 40, 360);
  const previewH = previewWidth * 1.45;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: FE.bg },
        kav: { flex: 1 },
        scrollContent: {
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingTop: MOBILE_SPACING.sm,
          paddingBottom: 56,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        mainPanel: {
          borderWidth: 1,
          borderColor: FE.panelBorder,
          borderRadius: MOBILE_RADII.lg,
          backgroundColor: FE.panel,
          padding: MOBILE_SPACING.lg,
        },
        backBtn: {
          alignSelf: 'flex-start',
          width: 'auto',
          maxWidth: 180,
          marginBottom: MOBILE_SPACING.md,
        },
        sectionTitle: {
          color: FE.text,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginBottom: MOBILE_SPACING.sm,
          marginTop: MOBILE_SPACING.xs,
        },
        title: { color: FE.text, fontSize: MOBILE_TYPE.title, fontWeight: '700', marginBottom: MOBILE_SPACING.sm },
        subtitle: { color: FE.sub, fontSize: MOBILE_TYPE.caption, marginBottom: MOBILE_SPACING.lg, lineHeight: 18 },
        label: { color: FE.sub, fontSize: MOBILE_TYPE.body, marginBottom: MOBILE_SPACING.sm, fontWeight: '600' },
        input: {
          backgroundColor: FE.inputBg,
          borderColor: FE.inputBorder,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          color: FE.text,
          padding: MOBILE_SPACING.md + 2,
          marginBottom: MOBILE_SPACING.md + 2,
          fontSize: MOBILE_TYPE.bodyStrong,
          minHeight: MOBILE_SIZES.controlHeight,
        },
        previewWrap: {
          alignSelf: 'center',
          width: previewWidth,
          marginBottom: MOBILE_SPACING.xl,
        },
        previewPhone: {
          borderRadius: MOBILE_RADII.lg,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: FE.panelBorder,
          height: previewH,
        },
        previewHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: MOBILE_SPACING.sm + 2,
          paddingTop: MOBILE_SPACING.md + 2,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: hexToRgba(validAccent, 0.35),
        },
        previewLogoDot: {
          width: 36,
          height: 36,
          borderRadius: MOBILE_RADII.sm,
          overflow: 'hidden',
          backgroundColor: hexToRgba(validAccent, 0.2),
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: MOBILE_SPACING.sm + 2,
        },
        previewBrand: { color: previewTokens.text, fontSize: MOBILE_TYPE.body, fontWeight: '800', flex: 1 },
        previewBody: { flex: 1, padding: MOBILE_SPACING.md, justifyContent: 'flex-end' },
        previewCard: {
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.md,
          backgroundColor: previewTokens.boxBg,
          borderWidth: 1,
          borderColor: previewTokens.overlayBorder,
        },
        previewCardText: { color: previewTokens.subText, fontSize: MOBILE_TYPE.caption },
        colorRow: { flexDirection: 'row', alignItems: 'center', gap: MOBILE_SPACING.md, marginBottom: MOBILE_SPACING.sm + 2 },
        colorPreview: {
          width: 44,
          height: 44,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1.5,
          borderColor: FE.panelBorder,
        },
        colorHint: { color: FE.sub, fontSize: MOBILE_TYPE.caption, flex: 1 },
        hueScroller: { paddingVertical: MOBILE_SPACING.xs },
        hueChip: {
          width: 26,
          height: 26,
          borderRadius: 13,
          marginRight: MOBILE_SPACING.sm,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
        },
        hueChipActive: { borderWidth: 2.5, borderColor: '#fff' },
        row: { flexDirection: 'row', gap: MOBILE_SPACING.md, marginBottom: MOBILE_SPACING.md + 2 },
        typeBtn: {
          flex: 1,
          paddingVertical: MOBILE_SPACING.md + 2,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1.5,
          alignItems: 'center',
          borderColor: FE.inputBorder,
          backgroundColor: FE.panel,
        },
        typeBtnActive: {
          borderColor: validAccent,
          backgroundColor: hexToRgba(validAccent, 0.12),
        },
        typeBtnText: { color: FE.sub, fontWeight: '600', fontSize: MOBILE_TYPE.body },
        typeBtnTextActive: { color: FE.text },
        pickerBlock: { marginBottom: MOBILE_SPACING.sm },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: MOBILE_SPACING.sm, marginBottom: MOBILE_SPACING.sm },
        chip: {
          paddingVertical: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.md,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          borderColor: FE.inputBorder,
          backgroundColor: FE.panel,
        },
        chipActive: {
          borderColor: validAccent,
          backgroundColor: hexToRgba(validAccent, 0.15),
        },
        chipText: { color: FE.sub, fontSize: MOBILE_TYPE.caption },
        chipTextActive: { color: FE.text, fontWeight: '600' },
        logoWrap: {
          width: 100,
          height: 100,
          borderRadius: MOBILE_RADII.lg,
          backgroundColor: FE.panel,
          borderWidth: 1,
          borderColor: FE.inputBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: MOBILE_SPACING.sm + 2,
        },
        logoImg: { width: '100%', height: '100%' },
        logoBtn: {
          paddingVertical: MOBILE_SPACING.sm + 2,
          paddingHorizontal: MOBILE_SPACING.lg,
          backgroundColor: hexToRgba(validAccent, 0.18),
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: hexToRgba(validAccent, 0.45),
          alignSelf: 'flex-start',
        },
        logoBtnText: { color: validAccent, fontSize: MOBILE_TYPE.body, fontWeight: '600' },
        bgPreviewWrap: {
          width: '100%',
          height: 120,
          borderRadius: MOBILE_RADII.md,
          backgroundColor: FE.panel,
          borderWidth: 1,
          borderColor: FE.inputBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: MOBILE_SPACING.md + 2,
        },
        bgPreviewImg: { width: '100%', height: '100%' },
        bgActionsGap: { marginBottom: MOBILE_SPACING.xl },
        urlSectionLabel: {
          color: FE.sub,
          fontSize: MOBILE_TYPE.caption,
          marginBottom: MOBILE_SPACING.sm,
          marginTop: MOBILE_SPACING.xs,
        },
        btn: {
          borderRadius: MOBILE_RADII.md,
          minHeight: MOBILE_SIZES.controlHeightLg,
          paddingVertical: MOBILE_SPACING.md,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: MOBILE_SPACING.xl,
          backgroundColor: hexToRgba(validAccent, 0.22),
          borderWidth: 1,
          borderColor: validAccent,
        },
        btnText: { color: FE.text, fontWeight: '700', fontSize: MOBILE_TYPE.bodyStrong },
      }),
    [validAccent, previewTokens, previewWidth, previewH],
  );

  const pickLogo = async () => {
    try {
      setPickingLogo(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(tStr('fe_alert_perm_gallery_logo_title'), tStr('fe_alert_perm_gallery_logo_body'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setLogoLocalUri(result.assets[0].uri);
    } catch (e) {
      Alert.alert(tStr('fe_alert_logo_pick_fail_title'), e?.message || tStr('fe_alert_pick_image_fail'));
    } finally {
      setPickingLogo(false);
    }
  };

  const uploadLogoForOrg = async (orgId, uri) => {
    if (!orgId || !uri) return null;
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
    const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'jpg';
    const path = `${orgId}/logo.${safeExt}`;
    const contentType = safeExt === 'png' ? 'image/png' : 'image/jpeg';
    const body = await imageUriToArrayBuffer(uri);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_ORG_LOGOS)
      .upload(path, body, { contentType, upsert: true });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(BUCKET_ORG_LOGOS).getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const pickBackground = async () => {
    try {
      setPickingBackground(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(tStr('fe_alert_bg_perm_title'), tStr('fe_alert_bg_perm_body'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.82,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setBackgroundLocalUri(result.assets[0].uri);
    } catch (e) {
      Alert.alert(tStr('fe_alert_bg_pick_fail_title'), e?.message || tStr('fe_alert_pick_image_fail'));
    } finally {
      setPickingBackground(false);
    }
  };

  const uploadBackgroundForOrg = async (orgId, uri) => {
    if (!orgId || !uri) return null;
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
    const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'jpg';
    const path = `${orgId}/background.${safeExt}`;
    const contentType = safeExt === 'png' ? 'image/png' : 'image/jpeg';
    const body = await imageUriToArrayBuffer(uri);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_ORG_BACKGROUNDS)
      .upload(path, body, { contentType, upsert: true });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(BUCKET_ORG_BACKGROUNDS).getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const handleCrear = async () => {
    const n = (name || '').trim();
    if (!n) {
      Alert.alert(tStr('fe_alert_name_title'), tStr('fe_alert_name_body'));
      return;
    }
    if (!user?.id) {
      Alert.alert(tStr('fe_alert_session_title'), tStr('fe_alert_session_body'));
      return;
    }
    setSaving(true);
    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: n,
          type: type || 'gym',
          accent_color: (accentColor || '').trim() || '#818cf8',
          theme_preset: themePreset || 'dark_vivid',
          background_type: backgroundType || 'solid',
          background_url: null,
          owner_id: user.id,
          active: true,
          plan_fitengine: 'trial',
          features: {
            reservations: true,
            onlinePrograms: false,
            videoLibrary: true,
            ...(validTextColor ? { text_color: validTextColor } : {}),
            ...(validTextSecondary ? { text_secondary_color: validTextSecondary } : {}),
          },
        })
        .select('id')
        .single();
      if (orgError) throw orgError;
      if (!org?.id) throw new Error(tStr('fe_alert_create_org_fail'));

      let storageSkipped = false;

      if (logoLocalUri) {
        try {
          const logoUrl = await uploadLogoForOrg(org.id, logoLocalUri);
          if (logoUrl) {
            const { error: logoUpdateError } = await supabase
              .from('organizations')
              .update({ logo_url: logoUrl })
              .eq('id', org.id);
            if (logoUpdateError) throw logoUpdateError;
          }
        } catch (e) {
          if (isStorageBucketMissingError(e)) {
            storageSkipped = true;
            console.log('🟠 ConfiguraTuEspacio: logo omitido (Storage bucket)', e?.message || e);
          } else {
            throw e;
          }
        }
      }

      if (backgroundType === 'image') {
        let finalBackgroundUrl = (backgroundUrl || '').trim() || null;
        let effectiveBgType = 'image';
        if (backgroundLocalUri) {
          try {
            const uploadedBg = await uploadBackgroundForOrg(org.id, backgroundLocalUri);
            if (uploadedBg) finalBackgroundUrl = uploadedBg;
          } catch (e) {
            if (isStorageBucketMissingError(e)) {
              storageSkipped = true;
              console.log('🟠 ConfiguraTuEspacio: fondo omitido (Storage bucket)', e?.message || e);
            } else {
              throw e;
            }
          }
        }
        if (!finalBackgroundUrl) {
          effectiveBgType = 'gradient';
        }
        const { error: bgUpdateError } = await supabase
          .from('organizations')
          .update({ background_url: finalBackgroundUrl, background_type: effectiveBgType })
          .eq('id', org.id);
        if (bgUpdateError) throw bgUpdateError;
      }

      // Solo un is_default activo por usuario (índice idx_org_memberships_one_default_active_per_user).
      const { error: clearDefErr } = await supabase
        .from('organization_memberships')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('active', true);
      if (clearDefErr) {
        console.log('🟠 ConfiguraTuEspacio: clear defaults', clearDefErr?.message || clearDefErr);
      }

      const { error: memErr } = await supabase.from('organization_memberships').upsert(
        {
          user_id: user.id,
          organization_id: org.id,
          role: 'owner',
          active: true,
          is_default: true,
        },
        { onConflict: 'user_id,organization_id,role' },
      );
      if (memErr) throw memErr;

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ organization_id: org.id, role: 'coach' })
        .eq('id', user.id);
      if (profErr) throw profErr;

      await Promise.all([
        typeof refreshProfile === 'function' ? refreshProfile() : Promise.resolve(),
        typeof refreshOrganization === 'function'
          ? refreshOrganization(org.id)
          : Promise.resolve(),
      ]);

      const goAdmin = () => navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
      if (storageSkipped) {
        Alert.alert(tStr('fe_alert_space_created_title'), tStr('fe_alert_space_created_body'), [
          { text: tStr('fe_alert_understood'), onPress: goAdmin },
        ]);
      } else {
        goAdmin();
      }
    } catch (err) {
      console.log('❌ ConfiguraTuEspacio crear', err);
      const msg =
        err?.message ||
        err?.details ||
        err?.hint ||
        (typeof err === 'string' ? err : JSON.stringify(err));
      Alert.alert(tStr('gym_config_alert_title_error'), msg || tStr('fe_alert_create_fail'));
    } finally {
      setSaving(false);
    }
  };

  const renderPreviewBackground = () => {
    const w = previewWidth;
    const h = previewH;
    if (backgroundType === 'image' && resolvedImageUri) {
      return (
        <Image
          source={{ uri: resolvedImageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      );
    }
    if (backgroundType === 'gradient') {
      return (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="fePreviewGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={validAccent} stopOpacity="1" />
              <Stop offset="1" stopColor={hexToRgba(validAccent, 0.35)} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect width={w} height={h} fill="url(#fePreviewGrad)" />
        </Svg>
      );
    }
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: previewTokens.bg }]} />;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
        >
          <View style={styles.mainPanel}>
          <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backBtn} />
          <Text style={styles.title}>{tStr('fe_setup_title')}</Text>
          <Text style={styles.subtitle}>{tStr('fe_setup_subtitle')}</Text>

          <Text style={styles.sectionTitle}>{tStr('fe_setup_preview')}</Text>
          <View style={styles.previewWrap}>
            <View style={styles.previewPhone}>
              {renderPreviewBackground()}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: 'transparent', justifyContent: 'space-between' },
                ]}
              >
                <View style={[styles.previewHeader, { backgroundColor: hexToRgba(validAccent, 0.12) }]}>
                  <View style={styles.previewLogoDot}>
                    {logoLocalUri ? (
                      <Image source={{ uri: logoLocalUri }} style={{ width: 36, height: 36 }} resizeMode="cover" />
                    ) : (
                      <Ionicons name="business" size={20} color={validAccent} />
                    )}
                  </View>
                  <Text style={styles.previewBrand} numberOfLines={1}>
                    {(name || '').trim() || tStr('fe_setup_name_placeholder')}
                  </Text>
                </View>
                <View style={styles.previewBody}>
                  <View style={styles.previewCard}>
                    <Text style={[styles.previewCardText, { color: previewTokens.text, fontWeight: '700' }]}>
                      {presetLabel(themePreset)}
                    </Text>
                    <Text style={[styles.previewCardText, { color: previewTokens.subText, marginTop: 6, fontSize: MOBILE_TYPE.caption }]}>
                      {tStr('fe_setup_secondary_line').replace('{{type}}', bgTypeLabel(backgroundType))}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.label}>{tStr('fe_setup_name_label')}</Text>
          <TextInput
            style={styles.input}
            placeholder={tStr('fe_setup_name_ph')}
            placeholderTextColor={FE.muted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>{tStr('fe_setup_type_label')}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'gym' && styles.typeBtnActive]}
              onPress={() => setType('gym')}
            >
              <Text style={[styles.typeBtnText, type === 'gym' && styles.typeBtnTextActive]}>
                {tStr('fe_setup_type_gym')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'coach' && styles.typeBtnActive]}
              onPress={() => setType('coach')}
            >
              <Text style={[styles.typeBtnText, type === 'coach' && styles.typeBtnTextActive]}>
                {tStr('fe_setup_type_coach')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{tStr('fe_setup_accent_label')}</Text>
          <View style={styles.colorRow}>
            <View style={[styles.colorPreview, { backgroundColor: validAccent }]} />
            <Text style={styles.colorHint}>{tStr('fe_setup_accent_hint')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hueScroller}>
            {HUES.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.hueChip,
                  { backgroundColor: color },
                  validAccent.toLowerCase() === color.toLowerCase() && styles.hueChipActive,
                ]}
                onPress={() => setAccentColor(color)}
                activeOpacity={0.8}
              />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hueScroller}>
            {LIGHT_STEPS.map((step) => {
              const base = HEX_RE.test(accentColor || '') ? accentColor : '#818cf8';
              const shade = applyLightness(base, step);
              return (
                <TouchableOpacity
                  key={`l-${step}`}
                  style={[
                    styles.hueChip,
                    { backgroundColor: shade },
                    validAccent.toLowerCase() === shade.toLowerCase() && styles.hueChipActive,
                  ]}
                  onPress={() => setAccentColor(shade)}
                  activeOpacity={0.8}
                />
              );
            })}
          </ScrollView>
          <TextInput
            style={styles.input}
            placeholder={tStr('fe_setup_hex_ph')}
            placeholderTextColor={FE.muted}
            value={accentColor}
            onChangeText={setAccentColor}
            autoCapitalize="none"
          />

          <View style={styles.pickerBlock}>
            <Text style={styles.label}>{tStr('fe_setup_preset_label')}</Text>
            <View style={styles.chipRow}>
              {['dark_vivid', 'dark_minimal', 'light_clean', 'light_warm'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setThemePreset(preset)}
                  style={[styles.chip, themePreset === preset && styles.chipActive]}
                >
                  <Text style={[styles.chipText, themePreset === preset && styles.chipTextActive]}>
                    {presetLabel(preset)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.subtitle, { marginTop: 8, marginBottom: 0, fontSize: 12 }]}>
              {presetHint(themePreset)}
            </Text>
          </View>

          <Text style={styles.label}>{tStr('fe_setup_text_primary_label')}</Text>
          <Text style={[styles.subtitle, { marginBottom: 8, fontSize: 12 }]}>{tStr('fe_setup_text_primary_hint')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hueScroller}>
            {TEXT_QUICK.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.hueChip,
                  { backgroundColor: c },
                  validTextColor?.toLowerCase() === c.toLowerCase() && styles.hueChipActive,
                ]}
                onPress={() => setTextColor(c)}
                activeOpacity={0.8}
              />
            ))}
          </ScrollView>
          <TextInput
            style={styles.input}
            placeholder={tStr('fe_setup_text_primary_ph')}
            placeholderTextColor={FE.muted}
            value={textColor}
            onChangeText={setTextColor}
            autoCapitalize="none"
          />

          <Text style={styles.label}>{tStr('fe_setup_text_secondary_label')}</Text>
          <Text style={[styles.subtitle, { marginBottom: 8, fontSize: 12 }]}>
            {tStr('fe_setup_text_secondary_hint')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hueScroller}>
            {TEXT_SECOND_QUICK.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.hueChip,
                  { backgroundColor: c },
                  validTextSecondary?.toLowerCase() === c.toLowerCase() && styles.hueChipActive,
                ]}
                onPress={() => setTextSecondaryColor(c)}
                activeOpacity={0.8}
              />
            ))}
          </ScrollView>
          <TextInput
            style={styles.input}
            placeholder={tStr('fe_setup_text_secondary_ph')}
            placeholderTextColor={FE.muted}
            value={textSecondaryColor}
            onChangeText={setTextSecondaryColor}
            autoCapitalize="none"
          />

          <View style={styles.pickerBlock}>
            <Text style={styles.label}>{tStr('fe_setup_bg_type_label')}</Text>
            <View style={styles.chipRow}>
              {['solid', 'gradient', 'image'].map((bt) => (
                <TouchableOpacity
                  key={bt}
                  onPress={() => setBackgroundType(bt)}
                  style={[styles.chip, backgroundType === bt && styles.chipActive]}
                >
                  <Text style={[styles.chipText, backgroundType === bt && styles.chipTextActive]}>
                    {bgTypeLabel(bt)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {backgroundType === 'image' && (
              <>
                <Text style={[styles.subtitle, { marginBottom: 8, fontSize: 12 }]}>
                  {tStr('fe_setup_bg_image_hint')}
                </Text>
                <View style={styles.bgPreviewWrap}>
                  {resolvedImageUri ? (
                    <Image source={{ uri: resolvedImageUri }} style={styles.bgPreviewImg} resizeMode="cover" />
                  ) : (
                    <Ionicons name="image-outline" size={38} color={FE.muted} />
                  )}
                </View>
                <View style={styles.bgActionsGap}>
                  <TouchableOpacity
                    style={styles.logoBtn}
                    onPress={pickBackground}
                    disabled={pickingBackground || saving}
                  >
                    {pickingBackground ? (
                      <ActivityIndicator size="small" color={validAccent} />
                    ) : (
                      <Text style={styles.logoBtnText}>{tStr('fe_setup_pick_bg')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.urlSectionLabel}>{tStr('fe_setup_url_section')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tStr('fe_setup_url_ph')}
                  placeholderTextColor={FE.muted}
                  value={backgroundUrl}
                  onChangeText={setBackgroundUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </>
            )}
          </View>

          <View style={styles.pickerBlock}>
            <Text style={styles.label}>{tStr('fe_setup_logo_label')}</Text>
            <View style={styles.logoWrap}>
              {logoLocalUri ? (
                <Image source={{ uri: logoLocalUri }} style={styles.logoImg} resizeMode="cover" />
              ) : (
                <Ionicons name="business" size={40} color={FE.muted} />
              )}
            </View>
            <TouchableOpacity style={styles.logoBtn} onPress={pickLogo} disabled={pickingLogo || saving}>
              {pickingLogo ? (
                <ActivityIndicator size="small" color={validAccent} />
              ) : (
                <Text style={styles.logoBtnText}>{tStr('fe_setup_pick_logo')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleCrear} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={FE.text} />
            ) : (
              <Text style={styles.btnText}>{tStr('fe_setup_submit')}</Text>
            )}
          </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
