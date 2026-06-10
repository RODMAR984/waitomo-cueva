// GymConfigScreen — Configuración de la organización (nombre, logo, color de acento)
// Solo owner/superadmin de la org. Fase 4.

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  useWindowDimensions,
  Linking,
  Pressable,
} from 'react-native';
import { useNavigation, useFocusEffect, usePreventRemove } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../../hooks/useStaffWebHideInlineBack';
import { supabase } from '../../supabaseClient';
import { getThemeTokens } from '../../theme/colors';
import { imageUriToArrayBuffer } from '../../utils/imageUriToArrayBuffer';
import LogoCompleto from '../../components/LogoCompleto';
import * as Clipboard from 'expo-clipboard';
import { generateClientInviteCode } from '../../utils/clientInviteCode';
import { buildClientInvitePublicLink, getFitEngineUrls } from '../../utils/fitengineUrls';
import { buildClientInviteShareMessage } from '../../utils/clientInviteShare';
import { FULL_HEX_CHOICE_GYM } from '../../utils/gymColorPalette';
import { DEFAULT_CLIENT_PAYMENT_COPY } from '../../utils/clientPaymentMethods';
import { draftMessageWithAi } from '../../utils/aiAssistant';
import { WEB_CONTENT_MAX_WIDTH, WEB_DESKTOP_BREAKPOINT } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

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

/** Versión del aviso de publicación en directorio (persistida en `features`). Subir y pedir re-aceptación al cambiar texto legal. */
const PUBLIC_DIRECTORY_TERMS_DOC_VERSION = 'v2';

function directoryListingTermsComplete(org, docVersion) {
  const f =
    org?.features && typeof org.features === 'object' && !Array.isArray(org.features) ? org.features : {};
  return !!f.public_directory_terms_v1 && String(f.public_directory_terms_doc_version || '') === String(docVersion);
}

function generatePlacesAutocompleteSessionToken() {
  let s = '';
  for (let i = 0; i < 32; i += 1) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}


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

function gymConfigBaselineString(org) {
  if (!org?.id) return '';
  const f = org.features && typeof org.features === 'object' && !Array.isArray(org.features) ? org.features : {};
  const cpObj =
    f.client_payment_methods && typeof f.client_payment_methods === 'object' && !Array.isArray(f.client_payment_methods)
      ? f.client_payment_methods
      : {};
  const mc = f.medical_clearance_policy;
  const medMode = mc?.mode === 'grace' || mc?.mode === 'flexible' ? mc.mode : 'strict';
  const medGrace =
    medMode === 'grace'
      ? Math.min(90, Math.max(0, parseInt(String(mc?.grace_days != null ? mc.grace_days : '0'), 10) || 0))
      : 0;
  let freezeDays = null;
  if (org.membership_freeze_max_days != null && Number.isFinite(Number(org.membership_freeze_max_days))) {
    freezeDays = Math.min(366, Math.max(1, Number(org.membership_freeze_max_days)));
  }
  return JSON.stringify({
    name: (org.name || '').trim(),
    billingCurrency: String(org.billing_currency || 'ARS').trim().toUpperCase(),
    timezone: String(org.timezone || 'America/Argentina/Buenos_Aires').trim(),
    accent: (org.accent_color || '').trim() || '#00dddd',
    logo: org.logo_url || null,
    theme: org.theme_preset || 'dark_vivid',
    bgType: org.background_type || 'solid',
    bgUrl: (org.background_url || '').trim() || '',
    textColor: f.text_color || org.text_color || '',
    textSecondary: f.text_secondary_color || '',
    surface: f.ui_surface_color || '',
    border: f.ui_border_color || '',
    overlay: f.ui_overlay_color || '',
    welcome: (f.client_welcome_message || '').trim(),
    lock: !!f.lock_client_theme,
    pm: {
      mercadopago: cpObj.mercadopago !== false,
      transferencia: cpObj.transferencia !== false,
      cuenta_dni: cpObj.cuenta_dni !== false,
      modo: cpObj.modo !== false,
      efectivo: cpObj.efectivo !== false,
      transfer_copy: (cpObj.transfer_copy || '').trim(),
      dni_copy: (cpObj.dni_copy || '').trim(),
      modo_copy: (cpObj.modo_copy || '').trim(),
    },
    medical: { mode: medMode, grace_days: medGrace },
    freezeEn: !!org.membership_freeze_enabled,
    freezeDays,
    pubDir: !!org.public_directory_enabled,
    placeId: (org.google_place_id || '').trim(),
    pubDirAck: directoryListingTermsComplete(org, PUBLIC_DIRECTORY_TERMS_DOC_VERSION),
  });
}

function gymConfigStateStringFromLocals(p) {
  const {
    name,
    billingCurrency,
    timezone,
    accentColor,
    logoUri,
    themePreset,
    backgroundType,
    backgroundUrl,
    clientWelcomeMessage,
    lockClientTheme,
    pmMercadopago,
    pmTransferencia,
    pmCuentaDni,
    pmModo,
    pmEfectivo,
    transferCopy,
    dniCopy,
    modoCopy,
    medicalPolicyMode,
    medicalGraceDays,
    membershipFreezeEnabled,
    membershipFreezeMaxDays,
    validTextColor,
    validTextSecondary,
    validSurfaceColor,
    validBorderColor,
    validOverlayColor,
    publicDirectoryEnabled,
    googlePlaceId,
    publicDirectoryTermsAck,
  } = p;

  const maxRaw = (membershipFreezeMaxDays || '').trim();
  let freezeDays = null;
  if (maxRaw !== '') {
    const n = parseInt(maxRaw, 10);
    if (Number.isFinite(n) && n >= 1) freezeDays = Math.min(366, n);
  }
  const medMode = medicalPolicyMode === 'grace' || medicalPolicyMode === 'flexible' ? medicalPolicyMode : 'strict';
  const medGrace =
    medMode === 'grace'
      ? Math.min(90, Math.max(0, parseInt(String(medicalGraceDays || '0').trim(), 10) || 0))
      : 0;

  return JSON.stringify({
    name: (name || '').trim(),
    billingCurrency: String(billingCurrency || 'ARS').trim().toUpperCase(),
    timezone: String(timezone || 'America/Argentina/Buenos_Aires').trim(),
    accent: (accentColor || '').trim() || '#00dddd',
    logo: logoUri || null,
    theme: themePreset || 'dark_vivid',
    bgType: backgroundType || 'solid',
    bgUrl: (backgroundUrl || '').trim() || '',
    textColor: validTextColor || '',
    textSecondary: validTextSecondary || '',
    surface: validSurfaceColor || '',
    border: validBorderColor || '',
    overlay: validOverlayColor || '',
    welcome: (clientWelcomeMessage || '').trim(),
    lock: !!lockClientTheme,
    pm: {
      mercadopago: pmMercadopago,
      transferencia: pmTransferencia,
      cuenta_dni: pmCuentaDni,
      modo: pmModo,
      efectivo: pmEfectivo,
      transfer_copy: (transferCopy || '').trim(),
      dni_copy: (dniCopy || '').trim(),
      modo_copy: (modoCopy || '').trim(),
    },
    medical: { mode: medMode, grace_days: medGrace },
    freezeEn: !!membershipFreezeEnabled,
    freezeDays,
    pubDir: !!publicDirectoryEnabled,
    placeId: (googlePlaceId || '').trim(),
    pubDirAck: !!publicDirectoryTermsAck,
  });
}

export default function GymConfigScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWebWide = isWeb && width >= WEB_DESKTOP_BREAKPOINT;
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const { t, mode } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const { user, profile, organization, refreshOrganization } = useAuth() || {};
  const orgId = organization?.id || profile?.organization_id;

  const [name, setName] = useState(organization?.name || '');
  const [billingCurrency, setBillingCurrency] = useState(
    String(organization?.billing_currency || 'ARS').trim().toUpperCase(),
  );
  const [orgTimezone, setOrgTimezone] = useState(
    String(organization?.timezone || 'America/Argentina/Buenos_Aires').trim(),
  );
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
  const cpInit = organization?.features?.client_payment_methods;
  const [pmMercadopago, setPmMercadopago] = useState(
    !cpInit || cpInit.mercadopago !== false,
  );
  const [pmTransferencia, setPmTransferencia] = useState(
    !cpInit || cpInit.transferencia !== false,
  );
  const [pmCuentaDni, setPmCuentaDni] = useState(!cpInit || cpInit.cuenta_dni !== false);
  const [pmModo, setPmModo] = useState(!cpInit || cpInit.modo !== false);
  const [pmEfectivo, setPmEfectivo] = useState(!cpInit || cpInit.efectivo !== false);
  const [transferCopy, setTransferCopy] = useState(
    typeof cpInit?.transfer_copy === 'string' ? cpInit.transfer_copy : '',
  );
  const [dniCopy, setDniCopy] = useState(typeof cpInit?.dni_copy === 'string' ? cpInit.dni_copy : '');
  const [modoCopy, setModoCopy] = useState(typeof cpInit?.modo_copy === 'string' ? cpInit.modo_copy : '');
  const mcInit = organization?.features?.medical_clearance_policy;
  const [medicalPolicyMode, setMedicalPolicyMode] = useState(
    mcInit?.mode === 'grace' || mcInit?.mode === 'flexible' ? mcInit.mode : 'strict',
  );
  const [medicalGraceDays, setMedicalGraceDays] = useState(
    Number.isFinite(Number(mcInit?.grace_days)) ? String(Math.max(0, Number(mcInit.grace_days))) : '0',
  );
  const [membershipFreezeEnabled, setMembershipFreezeEnabled] = useState(
    !!organization?.membership_freeze_enabled,
  );
  const [membershipFreezeMaxDays, setMembershipFreezeMaxDays] = useState(
    organization?.membership_freeze_max_days != null && Number.isFinite(Number(organization.membership_freeze_max_days))
      ? String(Math.max(1, Number(organization.membership_freeze_max_days)))
      : '',
  );
  const [publicDirectoryEnabled, setPublicDirectoryEnabled] = useState(
    !!organization?.public_directory_enabled,
  );
  const [googlePlaceId, setGooglePlaceId] = useState(
    String(organization?.google_place_id || '').trim(),
  );
  const [publicDirectoryTermsAck, setPublicDirectoryTermsAck] = useState(() =>
    directoryListingTermsComplete(organization, PUBLIC_DIRECTORY_TERMS_DOC_VERSION),
  );
  const [placeSyncBusy, setPlaceSyncBusy] = useState(false);
  const [placeAutocompleteQuery, setPlaceAutocompleteQuery] = useState('');
  const [placePredictions, setPlacePredictions] = useState([]);
  const [placeAutocompleteLoading, setPlaceAutocompleteLoading] = useState(false);
  const placeAutocompleteSessionRef = useRef(generatePlacesAutocompleteSessionToken());
  const placeAutocompleteTimerRef = useRef(null);
  /** Paleta completa plegada por defecto (menos invasiva). */
  const [paletteOpenKey, setPaletteOpenKey] = useState(null);
  /** Una pestaña = un tema; solo se monta el panel activo (toda la config sigue en el mismo save). */
  const [gymConfigTab, setGymConfigTab] = useState('general');
  const gymConfigScrollRef = useRef(null);
  const [brandBrief, setBrandBrief] = useState('');
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandDraft, setBrandDraft] = useState('');

  const buildBrandingFallback = useCallback(
    () =>
      [
        `Sugerencia de branding para ${(name || organization?.name || 'tu gym').trim()}:`,
        '',
        'PRESET=dark_vivid',
        'ACCENT=#00DDDD',
        'TEXT_PRIMARY=#E2E8F0',
        'TEXT_SECONDARY=#94A3B8',
        'SURFACE=#0F172A',
        'BORDER=#334155',
        'OVERLAY=#0B1220CC',
        'VOICE=motivador, cercano y profesional',
        'CTA=Empezar hoy',
        'TAGLINE=Entrená con foco. Progresá en serio.',
        'WELCOME=Bienvenido/a. Elegí tu plan y empezá hoy con una rutina clara.',
        'WHY=Contraste alto, legibilidad móvil y tono consistente para conversión.',
      ].join('\n'),
    [name, organization?.name],
  );

  useEffect(() => {
    gymConfigScrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [gymConfigTab]);

  useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      setBillingCurrency(String(organization.billing_currency || 'ARS').trim().toUpperCase());
      setOrgTimezone(String(organization.timezone || 'America/Argentina/Buenos_Aires').trim());
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
      const cp = organization.features?.client_payment_methods;
      if (cp && typeof cp === 'object' && !Array.isArray(cp)) {
        setPmMercadopago(cp.mercadopago !== false);
        setPmTransferencia(cp.transferencia !== false);
        setPmCuentaDni(cp.cuenta_dni !== false);
        setPmModo(cp.modo !== false);
        setPmEfectivo(cp.efectivo !== false);
        setTransferCopy(typeof cp.transfer_copy === 'string' ? cp.transfer_copy : '');
        setDniCopy(typeof cp.dni_copy === 'string' ? cp.dni_copy : '');
        setModoCopy(typeof cp.modo_copy === 'string' ? cp.modo_copy : '');
      } else {
        setPmMercadopago(true);
        setPmTransferencia(true);
        setPmCuentaDni(true);
        setPmModo(true);
        setPmEfectivo(true);
        setTransferCopy('');
        setDniCopy('');
        setModoCopy('');
      }
      const mc = organization.features?.medical_clearance_policy;
      setMedicalPolicyMode(mc?.mode === 'grace' || mc?.mode === 'flexible' ? mc.mode : 'strict');
      setMedicalGraceDays(
        Number.isFinite(Number(mc?.grace_days)) ? String(Math.max(0, Number(mc.grace_days))) : '0',
      );
      setMembershipFreezeEnabled(!!organization.membership_freeze_enabled);
      setMembershipFreezeMaxDays(
        organization.membership_freeze_max_days != null &&
          Number.isFinite(Number(organization.membership_freeze_max_days))
          ? String(Math.max(1, Number(organization.membership_freeze_max_days)))
          : '',
      );
      setPublicDirectoryEnabled(!!organization.public_directory_enabled);
      setGooglePlaceId(String(organization.google_place_id || '').trim());
      const f = organization.features;
      const feat = f && typeof f === 'object' && !Array.isArray(f) ? f : {};
      setPublicDirectoryTermsAck(
        directoryListingTermsComplete(organization, PUBLIC_DIRECTORY_TERMS_DOC_VERSION),
      );
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
    organization?.membership_freeze_enabled,
    organization?.membership_freeze_max_days,
    organization?.public_directory_enabled,
    organization?.google_place_id,
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

  const gymConfigDirty = useMemo(() => {
    if (!organization?.id || !canEdit) return false;
    if (backgroundLocalUri) return true;
    return (
      gymConfigBaselineString(organization) !==
      gymConfigStateStringFromLocals({
        name,
        billingCurrency,
        timezone: orgTimezone,
        accentColor,
        logoUri,
        themePreset,
        backgroundType,
        backgroundUrl,
        clientWelcomeMessage,
        lockClientTheme,
        pmMercadopago,
        pmTransferencia,
        pmCuentaDni,
        pmModo,
        pmEfectivo,
        transferCopy,
        dniCopy,
        modoCopy,
        medicalPolicyMode,
        medicalGraceDays,
        membershipFreezeEnabled,
        membershipFreezeMaxDays,
        validTextColor,
        validTextSecondary,
        validSurfaceColor,
        validBorderColor,
        validOverlayColor,
        publicDirectoryEnabled,
        googlePlaceId,
        publicDirectoryTermsAck,
      })
    );
  }, [
    organization,
    canEdit,
    backgroundLocalUri,
    name,
    billingCurrency,
    orgTimezone,
    accentColor,
    logoUri,
    themePreset,
    backgroundType,
    backgroundUrl,
    clientWelcomeMessage,
    lockClientTheme,
    pmMercadopago,
    pmTransferencia,
    pmCuentaDni,
    pmModo,
    pmEfectivo,
    transferCopy,
    dniCopy,
    modoCopy,
    medicalPolicyMode,
    medicalGraceDays,
    membershipFreezeEnabled,
    membershipFreezeMaxDays,
    validTextColor,
    validTextSecondary,
    validSurfaceColor,
    validBorderColor,
    validOverlayColor,
    publicDirectoryEnabled,
    googlePlaceId,
    publicDirectoryTermsAck,
  ]);

  const onTogglePublicDirectory = useCallback(
    (next) => {
      if (next && !publicDirectoryTermsAck) {
        Alert.alert(tStr('gym_config_perm_title'), tStr('gym_config_public_directory_must_ack'));
        return;
      }
      setPublicDirectoryEnabled(next);
      if (!next) setPublicDirectoryTermsAck(false);
    },
    [publicDirectoryTermsAck, tStr],
  );

  useEffect(() => {
    placeAutocompleteSessionRef.current = generatePlacesAutocompleteSessionToken();
    setPlacePredictions([]);
    setPlaceAutocompleteQuery('');
  }, [organization?.id]);

  const openFitEngineTerms = useCallback(() => {
    const u = getFitEngineUrls().termsUrl;
    if (u) void Linking.openURL(u);
  }, []);

  const openFitEnginePrivacy = useCallback(() => {
    const u = getFitEngineUrls().privacyUrl;
    if (u) void Linking.openURL(u);
  }, []);

  const runPlacesAutocomplete = useCallback(
    async (raw) => {
      const q = String(raw || '').trim();
      if (!orgId || !canEdit || gymConfigTab !== 'directory') return;
      if (q.length < 2) {
        setPlacePredictions([]);
        return;
      }
      setPlaceAutocompleteLoading(true);
      try {
        const lang = locale === 'pt' ? 'pt' : locale === 'en' ? 'en' : 'es';
        const { data, error } = await supabase.functions.invoke('places-autocomplete', {
          body: {
            organization_id: orgId,
            input: q,
            session_token: placeAutocompleteSessionRef.current,
            language: lang,
          },
        });
        if (error) throw error;
        const list = Array.isArray(data?.predictions) ? data.predictions : [];
        setPlacePredictions(list);
      } catch (_) {
        setPlacePredictions([]);
      } finally {
        setPlaceAutocompleteLoading(false);
      }
    },
    [orgId, canEdit, gymConfigTab, locale],
  );

  useEffect(() => {
    if (gymConfigTab !== 'directory') return undefined;
    if (placeAutocompleteTimerRef.current) clearTimeout(placeAutocompleteTimerRef.current);
    placeAutocompleteTimerRef.current = setTimeout(() => {
      void runPlacesAutocomplete(placeAutocompleteQuery);
    }, 360);
    return () => {
      if (placeAutocompleteTimerRef.current) clearTimeout(placeAutocompleteTimerRef.current);
    };
  }, [placeAutocompleteQuery, gymConfigTab, runPlacesAutocomplete]);

  const onPickPlacePrediction = useCallback((item) => {
    if (!item?.place_id) return;
    setGooglePlaceId(String(item.place_id).trim());
    const label =
      item.description ||
      [item.main_text, item.secondary_text].filter(Boolean).join(' · ');
    setPlaceAutocompleteQuery(String(label || '').trim());
    setPlacePredictions([]);
    // Mismo session_token hasta Place Details (sync); Google agrupa la sesión de facturación.
  }, []);

  usePreventRemove(
    gymConfigDirty,
    ({ data }) => {
      Alert.alert(tStr('nav_unsaved_discard_title'), tStr('nav_unsaved_discard_body'), [
        { text: tStr('nav_unsaved_stay'), style: 'cancel' },
        {
          text: tStr('nav_unsaved_discard'),
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ]);
    },
  );

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
    let membershipFreezeMaxDaysOut = null;
    const maxRaw = (membershipFreezeMaxDays || '').trim();
    if (maxRaw !== '') {
      const n = parseInt(maxRaw, 10);
      if (!Number.isFinite(n) || n < 1) {
        Alert.alert(tStr('gym_config_alert_title_error'), tStr('gym_config_membership_freeze_max_invalid'));
        return;
      }
      membershipFreezeMaxDaysOut = Math.min(366, n);
    }
    const curr = String(billingCurrency || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(curr)) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('gym_config_currency_invalid'));
      return;
    }
    const tz = String(orgTimezone || '').trim();
    if (!tz) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('gym_config_timezone_invalid'));
      return;
    }
    if (publicDirectoryEnabled && !publicDirectoryTermsAck) {
      Alert.alert(tStr('gym_config_perm_title'), tStr('gym_config_public_directory_must_ack'));
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

      prevFeatures.client_payment_methods = {
        mercadopago: pmMercadopago,
        transferencia: pmTransferencia,
        cuenta_dni: pmCuentaDni,
        modo: pmModo,
        efectivo: pmEfectivo,
        transfer_copy: (transferCopy || '').trim(),
        dni_copy: (dniCopy || '').trim(),
        modo_copy: (modoCopy || '').trim(),
      };
      prevFeatures.medical_clearance_policy = {
        mode: medicalPolicyMode === 'grace' || medicalPolicyMode === 'flexible' ? medicalPolicyMode : 'strict',
        grace_days:
          medicalPolicyMode === 'grace'
            ? Math.min(90, Math.max(0, parseInt(String(medicalGraceDays || '0').trim(), 10) || 0))
            : 0,
      };

      if (publicDirectoryEnabled) {
        if (!prevFeatures.public_directory_terms_v1) {
          prevFeatures.public_directory_terms_v1 = new Date().toISOString();
        }
        prevFeatures.public_directory_terms_doc_version = PUBLIC_DIRECTORY_TERMS_DOC_VERSION;
      } else {
        delete prevFeatures.public_directory_terms_v1;
        delete prevFeatures.public_directory_terms_doc_version;
      }

      const { error } = await supabase
        .from('organizations')
        .update({
          name: trimmedName,
          billing_currency: String(billingCurrency || 'ARS').trim().toUpperCase() || 'ARS',
          timezone: String(orgTimezone || 'America/Argentina/Buenos_Aires').trim() || 'America/Argentina/Buenos_Aires',
          accent_color: (accentColor || '').trim() || '#00dddd',
          logo_url: logoUri || null,
          theme_preset: themePreset || 'dark_vivid',
          background_type: backgroundType || 'solid',
          background_url: (backgroundUrl || '').trim() || null,
          features: prevFeatures,
          membership_freeze_enabled: !!membershipFreezeEnabled,
          membership_freeze_max_days: membershipFreezeMaxDaysOut,
          public_directory_enabled: !!publicDirectoryEnabled,
          google_place_id: (googlePlaceId || '').trim() || null,
        })
        .eq('id', orgId);
      if (error) throw error;
      if (typeof refreshOrganization === 'function') await refreshOrganization();
      Alert.alert(tStr('gym_config_saved_title'), tStr('gym_config_saved_body'));
      // Deferir: el efecto que alinea el estado con `organization` corre tras el commit; si no, usePreventRemove ve aún dirty.
      setTimeout(() => {
        if (navigation.canGoBack()) navigation.goBack();
      }, 0);
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
    medicalPolicyMode,
    medicalGraceDays,
    refreshOrganization,
    tStr,
  ]);

  const syncGooglePlaceSummary = useCallback(async () => {
    if (!orgId || !canEdit) return;
    const pid = (googlePlaceId || '').trim();
    if (!pid) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('gym_config_google_place_id_hint'));
      return;
    }
    setPlaceSyncBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-place-summary', {
        body: {
          organization_id: orgId,
          place_id: pid,
          session_token: placeAutocompleteSessionRef.current,
        },
      });
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.message || String(data.error));
      }
      if (typeof refreshOrganization === 'function') await refreshOrganization(orgId);
      placeAutocompleteSessionRef.current = generatePlacesAutocompleteSessionToken();
      Alert.alert(tStr('gym_config_saved_title'), tStr('gym_config_sync_google_ok'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('gym_config_sync_google_fail'));
    } finally {
      setPlaceSyncBusy(false);
    }
  }, [orgId, canEdit, googlePlaceId, refreshOrganization, tStr]);

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
        tStr('gym_config_copy_link_help').replace('{{link}}', url),
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
    const link = buildClientInvitePublicLink(c);
    const message = buildClientInviteShareMessage({
      gymName: gym,
      code: c,
      messageTemplate: tStr('gym_invite_share_message'),
      storesBlockTemplate: tStr('gym_invite_share_stores_block'),
    });
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message, url: link, title: 'FitEngine' }
          : { message, title: 'FitEngine' },
      );
    } catch (e) {
      if (e?.message !== 'User did not share') {
        Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('gym_config_share_fail'));
      }
    }
  }, [organization?.client_invite_code, name, organization?.name, tStr]);

  const runBrandingAssistant = useCallback(async () => {
    if (!orgId) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('gym_config_err_no_org'));
      return;
    }
    const brief = String(brandBrief || '').trim();
    setBrandBusy(true);
    try {
      const base = [
        `Gym: ${(name || organization?.name || 'Sin nombre').trim()}`,
        `Estilo actual: ${themePreset || 'dark_vivid'}`,
        `Acento actual: ${(accentColor || '').trim() || '#00dddd'}`,
        `Mensaje actual: ${(clientWelcomeMessage || '').trim() || '(vacío)'}`,
        `Preferencias del dueño: ${brief || '(sin preferencias)'}`,
      ].join('\n');
      const out = await draftMessageWithAi({
        organizationId: orgId,
        rawText: base,
        titleHint: 'Asistente de branding de gym',
        planKey: 'gym_branding',
        slotLabel: '',
        sessionDate: '',
        extraNotes:
          'Respondé en español en líneas EXACTAS (sin bullets), con este formato: PRESET=... ACCENT=#RRGGBB TEXT_PRIMARY=#RRGGBB TEXT_SECONDARY=#RRGGBB SURFACE=#RRGGBB BORDER=#RRGGBB OVERLAY=#RRGGBBAA VOICE=... CTA=... TAGLINE=... WELCOME=... WHY=... . Colores en HEX estricto (6 dígitos, y 8 solo para OVERLAY). No inventar planes/horarios/pagos.',
      });
      const text = String(out?.result?.result_text || '').trim();
      if (!text) throw new Error(tStr('gym_branding_ai_fail'));
      setBrandDraft(text);
      const line = (k) => {
        const m = text.match(new RegExp(`(?:^|\\n)\\s*${k}\\s*=\\s*(.+)`, 'i'));
        return m ? String(m[1]).trim() : '';
      };
      const vPreset = line('PRESET');
      const vAccent = line('ACCENT');
      const vText = line('TEXT_PRIMARY');
      const vSub = line('TEXT_SECONDARY');
      const vSurface = line('SURFACE');
      const vBorder = line('BORDER');
      const vOverlay = line('OVERLAY');
      const vWelcome = line('WELCOME');
      const normalizeHex = (value, { allowAlpha = false } = {}) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const re = allowAlpha ? /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/ : /^#[0-9a-fA-F]{6}$/;
        if (!re.test(raw)) return '';
        return `#${raw.slice(1).toUpperCase()}`;
      };
      if (vPreset) setThemePreset(vPreset);
      const normAccent = normalizeHex(vAccent);
      const normText = normalizeHex(vText);
      const normSub = normalizeHex(vSub);
      const normSurface = normalizeHex(vSurface);
      const normBorder = normalizeHex(vBorder);
      const normOverlay = normalizeHex(vOverlay, { allowAlpha: true });
      if (normAccent) setAccentColor(normAccent);
      if (normText) setTextColor(normText);
      if (normSub) setTextSecondaryColor(normSub);
      if (normSurface) setSurfaceColor(normSurface);
      if (normBorder) setBorderColor(normBorder);
      if (normOverlay) setOverlayColor(normOverlay);
      if (vWelcome) setClientWelcomeMessage(vWelcome);
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('quota')) {
        Alert.alert(tStr('admin_ai_quota_title'), tStr('admin_ai_quota_body'));
      } else if (
        msg.includes('502') ||
        msg.toLowerCase().includes('gemini') ||
        msg.toLowerCase().includes('ai_generation_failed')
      ) {
        setBrandDraft(buildBrandingFallback());
        Alert.alert(tStr('gym_branding_fallback_title'), tStr('gym_branding_fallback_body'));
      } else {
        Alert.alert(tStr('gym_config_alert_title_error'), msg || tStr('gym_branding_ai_fail'));
      }
    } finally {
      setBrandBusy(false);
    }
  }, [
    orgId,
    brandBrief,
    name,
    organization?.name,
    tStr,
    buildBrandingFallback,
    themePreset,
    accentColor,
    clientWelcomeMessage,
  ]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          padding: MOBILE_SPACING.xl,
          paddingTop: 56,
          width: '100%',
          alignSelf: 'center',
          maxWidth: isWeb ? WEB_CONTENT_MAX_WIDTH : undefined,
        },
        header: { flexDirection: 'row', alignItems: 'center', marginBottom: MOBILE_SPACING.xxl },
        backBtn: { marginLeft: 0, width: 'auto', maxWidth: 180, alignSelf: 'flex-start' },
        title: { color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: '800', marginLeft: MOBILE_SPACING.sm },
        scroll: { paddingBottom: MOBILE_SPACING.xxl + MOBILE_SPACING.lg },
        tabBarWrap: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          marginBottom: MOBILE_SPACING.md + 2,
          gap: MOBILE_SPACING.sm,
        },
        tabChip: {
          paddingVertical: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.md,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
        },
        tabChipActive: { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.14) },
        tabChipText: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        tabChipTextActive: { color: t.brand },
        sectionHeading: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800', marginBottom: MOBILE_SPACING.sm },
        sectionIntro: { color: t.subText, fontSize: MOBILE_TYPE.caption, lineHeight: 19, marginBottom: MOBILE_SPACING.xl - 2 },
        subHeading: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800', marginBottom: MOBILE_SPACING.sm + 2 },
        block: { marginBottom: MOBILE_SPACING.xl },
        label: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: MOBILE_SPACING.sm, fontWeight: '600' },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          padding: MOBILE_SPACING.md,
          color: t.text,
          backgroundColor: t.inputBg,
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        logoWrap: {
          width: 100,
          height: 100,
          borderRadius: MOBILE_RADII.lg,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        logoImg: { width: '100%', height: '100%' },
        logoBtn: {
          marginTop: MOBILE_SPACING.sm + 2,
          paddingVertical: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.md + 2,
          backgroundColor: hexToRgba(t.brand, 0.2),
          borderRadius: MOBILE_RADII.sm,
          alignSelf: 'flex-start',
        },
        logoBtnSpaced: { marginTop: MOBILE_SPACING.md },
        logoBtnText: { color: t.brand, fontSize: MOBILE_TYPE.body, fontWeight: '600' },
        onboardingCard: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          backgroundColor: t.boxBg,
          padding: MOBILE_SPACING.md,
          marginTop: MOBILE_SPACING.sm,
        },
        onboardingTitle: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800', marginBottom: MOBILE_SPACING.sm },
        onboardingHint: { color: t.subText, fontSize: MOBILE_TYPE.caption, lineHeight: 17, marginBottom: MOBILE_SPACING.sm + 2 },
        onboardingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: MOBILE_SPACING.sm + 2 },
        onboardingBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: MOBILE_SPACING.sm, marginTop: MOBILE_SPACING.sm + 2 },
        saveBtn: {
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.sm,
          minHeight: MOBILE_SIZES.controlHeightLg,
          paddingVertical: MOBILE_SPACING.md,
          marginTop: MOBILE_SPACING.xl - 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        saveBtnText: { ...t.buttonPrimaryText, fontSize: MOBILE_TYPE.bodyStrong },
        hint: { color: t.placeholder, fontSize: MOBILE_TYPE.caption, marginTop: MOBILE_SPACING.sm },
        previewCard: {
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          padding: MOBILE_SPACING.md + 2,
          marginTop: MOBILE_SPACING.sm,
        },
        previewTitle: { fontSize: MOBILE_TYPE.body, fontWeight: '700', marginBottom: MOBILE_SPACING.sm + 2 },
        previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        previewBadge: { borderRadius: MOBILE_RADII.sm, paddingVertical: 7, paddingHorizontal: MOBILE_SPACING.md, borderWidth: 1 },
        previewBadgeText: { fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        liveSimBlock: {
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          padding: MOBILE_SPACING.md,
          marginBottom: MOBILE_SPACING.sm,
        },
        liveLegendWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 8 },
        liveLegendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          marginRight: 10,
          marginBottom: 8,
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderRadius: MOBILE_RADII.compact,
          backgroundColor: hexToRgba(t.brand, 0.06),
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        liveLegendDot: { width: 14, height: 14, borderRadius: 7, marginRight: 6, borderWidth: 1, borderColor: 'rgba(148,163,184,0.5)' },
        liveLegendLabel: { color: t.subText, fontSize: MOBILE_TYPE.micro, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
        liveLegendPreset: { color: t.text, fontSize: MOBILE_TYPE.meta, fontWeight: '700', maxWidth: 100 },
        paletteRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, width: '100%' },
        paletteBtn: {
          borderWidth: 1,
          borderRadius: MOBILE_RADII.sm,
          paddingVertical: 9,
          paddingHorizontal: MOBILE_SPACING.sm + 2,
          minWidth: 92,
          marginRight: MOBILE_SPACING.sm,
          marginBottom: MOBILE_SPACING.sm,
        },
        paletteSwatches: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
        paletteDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, marginRight: 6 },
        paletteLabel: { fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        bgPreviewWrap: {
          width: '100%',
          height: 120,
          borderRadius: MOBILE_RADII.md,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginTop: MOBILE_SPACING.sm + 2,
          marginBottom: MOBILE_SPACING.sm,
        },
        bgPreviewImg: { width: '100%', height: '100%' },
        colorGridScroll: { maxHeight: 280, marginTop: 8 },
        colorGridWrap: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', paddingBottom: 8 },
        colorGridChip: { width: 28, height: 28, borderRadius: MOBILE_RADII.xs, margin: 3, borderWidth: 1 },
        paletteToggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 11,
          paddingHorizontal: MOBILE_SPACING.md,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
          marginTop: MOBILE_SPACING.sm,
        },
        paletteToggleLabel: { flex: 1, marginLeft: MOBILE_SPACING.sm, color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '700' },
        paletteToggleHint: { color: t.placeholder, fontSize: MOBILE_TYPE.caption, marginRight: MOBILE_SPACING.sm },
        palettePreviewSwatch: {
          width: 22,
          height: 22,
          borderRadius: MOBILE_RADII.xs,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
      }),
    [t, isWeb, isWebWide]
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
        ref={gymConfigScrollRef}
        style={styles.screen}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          {!hideInlineBack ? (
            <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backBtn} />
          ) : null}
          <Text style={styles.title}>{tStr('gym_config_screen_title')}</Text>
        </View>

        <View style={styles.tabBarWrap}>
          {[
            ['general', 'gym_config_tab_general'],
            ['brand_ai', 'gym_config_tab_brand_ai'],
            ['payments', 'gym_config_tab_payments'],
            ['medical', 'gym_config_tab_medical'],
            ['membership', 'gym_config_tab_membership'],
            ['invites', 'gym_config_tab_invites'],
            ['directory', 'gym_config_tab_directory'],
            ['appearance', 'gym_config_tab_appearance'],
            ['branding', 'gym_config_tab_branding'],
          ].map(([id, labelKey]) => {
            const on = gymConfigTab === id;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => setGymConfigTab(id)}
                style={[styles.tabChip, on && styles.tabChipActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabChipText, on && styles.tabChipTextActive]}>{tStr(labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {gymConfigTab === 'general' ? (
          <>
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
          <Text style={[styles.label, { marginTop: 10 }]}>{tStr('gym_config_currency_label')}</Text>
          <TextInput
            style={styles.input}
            value={billingCurrency}
            onChangeText={(v) => setBillingCurrency(String(v || '').toUpperCase().slice(0, 3))}
            placeholder={tStr('gym_config_currency_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
            autoCapitalize="characters"
            maxLength={3}
          />
          <Text style={[styles.label, { marginTop: 10 }]}>{tStr('gym_config_timezone_label')}</Text>
          <TextInput
            style={styles.input}
            value={orgTimezone}
            onChangeText={setOrgTimezone}
            placeholder={tStr('gym_config_timezone_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>{tStr('gym_config_timezone_hint')}</Text>
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

          </>
        ) : null}

        {gymConfigTab === 'brand_ai' ? (
          <View style={styles.block}>
            <View style={styles.onboardingCard}>
              <Text style={styles.onboardingTitle}>{tStr('gym_branding_title')}</Text>
              <Text style={styles.onboardingHint}>{tStr('gym_branding_hint')}</Text>
              <Text style={styles.label}>{tStr('gym_branding_brief_label')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 66, textAlignVertical: 'top' }]}
                value={brandBrief}
                onChangeText={setBrandBrief}
                placeholder={tStr('gym_branding_brief_ph')}
                placeholderTextColor={t.placeholder}
                editable={canEdit && !brandBusy}
                multiline
              />
              <Text style={styles.hint}>{tStr('gym_branding_outputs_hint')}</Text>
              <TouchableOpacity
                style={[styles.logoBtn, { marginTop: 12, opacity: brandBusy ? 0.6 : 1 }]}
                onPress={runBrandingAssistant}
                disabled={!canEdit || brandBusy}
                activeOpacity={0.85}
              >
                {brandBusy ? (
                  <ActivityIndicator size="small" color={t.brand} />
                ) : (
                  <Text style={styles.logoBtnText}>{tStr('gym_branding_generate')}</Text>
                )}
              </TouchableOpacity>
              {brandDraft ? (
                <>
                  <Text style={[styles.label, { marginTop: 12 }]}>{tStr('gym_branding_result')}</Text>
                  <Text style={[styles.input, { minHeight: 140 }]}>{brandDraft}</Text>
                  <View style={styles.onboardingBtnRow}>
                    <TouchableOpacity style={styles.logoBtn} onPress={save} activeOpacity={0.85}>
                      <Text style={styles.logoBtnText}>{tStr('gym_branding_save_now')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.logoBtn} onPress={() => setGymConfigTab('appearance')} activeOpacity={0.85}>
                      <Text style={styles.logoBtnText}>{tStr('gym_branding_go_appearance')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        {gymConfigTab === 'payments' ? (
        <View style={styles.block}>
          <Text style={styles.label}>{tStr('gym_config_payment_section_title')}</Text>
          <Text style={styles.hint}>{tStr('gym_config_payment_section_hint')}</Text>

          {[
            ['mp', pmMercadopago, setPmMercadopago, 'gym_config_payment_toggle_mp'],
            ['tr', pmTransferencia, setPmTransferencia, 'gym_config_payment_toggle_transfer'],
            ['dn', pmCuentaDni, setPmCuentaDni, 'gym_config_payment_toggle_dni'],
            ['mo', pmModo, setPmModo, 'gym_config_payment_toggle_modo'],
            ['ef', pmEfectivo, setPmEfectivo, 'gym_config_payment_toggle_cash'],
          ].map(([key, val, setVal, labelKey]) => (
            <View
              key={key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: key === 'mp' ? 10 : 12,
                paddingVertical: 4,
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.subHeading}>{tStr(labelKey)}</Text>
              </View>
              <Switch
                value={val}
                onValueChange={canEdit ? setVal : undefined}
                disabled={!canEdit}
                trackColor={{ false: t.overlayBorder, true: t.brand }}
                thumbColor="#f4ffff"
              />
            </View>
          ))}

          {pmTransferencia ? (
            <>
              <Text style={[styles.label, { marginTop: 14 }]}>{tStr('gym_config_payment_copy_transfer')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
                value={transferCopy}
                onChangeText={setTransferCopy}
                placeholder={DEFAULT_CLIENT_PAYMENT_COPY.transfer_copy}
                placeholderTextColor={t.placeholder}
                editable={canEdit}
                multiline
              />
            </>
          ) : null}

          {pmCuentaDni ? (
            <>
              <Text style={[styles.label, { marginTop: 10 }]}>{tStr('gym_config_payment_copy_dni')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
                value={dniCopy}
                onChangeText={setDniCopy}
                placeholder={DEFAULT_CLIENT_PAYMENT_COPY.dni_copy}
                placeholderTextColor={t.placeholder}
                editable={canEdit}
                multiline
              />
            </>
          ) : null}

          {pmModo ? (
            <>
              <Text style={[styles.label, { marginTop: 10 }]}>{tStr('gym_config_payment_copy_modo')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
                value={modoCopy}
                onChangeText={setModoCopy}
                placeholder={DEFAULT_CLIENT_PAYMENT_COPY.modo_copy}
                placeholderTextColor={t.placeholder}
                editable={canEdit}
                multiline
              />
            </>
          ) : null}
        </View>
        ) : null}

        {gymConfigTab === 'medical' ? (
        <View style={styles.block}>
          <Text style={styles.label}>{tStr('gym_config_medical_policy_title')}</Text>
          <Text style={styles.hint}>{tStr('gym_config_medical_policy_hint')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {[
              { id: 'strict', label: tStr('gym_config_medical_policy_strict') },
              { id: 'grace', label: tStr('gym_config_medical_policy_grace') },
              { id: 'flexible', label: tStr('gym_config_medical_policy_flexible') },
            ].map((opt) => {
              const on = medicalPolicyMode === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => canEdit && setMedicalPolicyMode(opt.id)}
                  disabled={!canEdit}
                  style={[
                    {
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: MOBILE_RADII.sm,
                      borderWidth: 1,
                      borderColor: t.overlayBorder,
                      backgroundColor: t.inputBg,
                    },
                    on ? { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.12) } : null,
                  ]}
                >
                  <Text style={{ color: on ? t.brand : t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {medicalPolicyMode === 'grace' ? (
            <>
              <Text style={[styles.label, { marginTop: 12 }]}>{tStr('gym_config_medical_grace_days_label')}</Text>
              <TextInput
                style={styles.input}
                value={medicalGraceDays}
                onChangeText={setMedicalGraceDays}
                placeholder={tStr('gym_config_medical_grace_days_ph')}
                placeholderTextColor={t.placeholder}
                editable={canEdit}
                keyboardType="number-pad"
              />
              <Text style={styles.hint}>
                {tStr('gym_config_medical_grace_days_hint').replace(
                  '{{n}}',
                  String(Math.min(90, Math.max(0, parseInt(String(medicalGraceDays || '0').trim(), 10) || 0))),
                )}
              </Text>
            </>
          ) : null}
        </View>
        ) : null}

        {gymConfigTab === 'membership' ? (
        <View style={styles.block}>
          <Text style={styles.label}>{tStr('gym_config_membership_freeze_title')}</Text>
          <Text style={styles.hint}>{tStr('gym_config_membership_freeze_hint')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <Text style={{ color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '700', flex: 1, paddingRight: 12 }}>
              {tStr('gym_config_membership_freeze_toggle')}
            </Text>
            <Switch
              value={!!membershipFreezeEnabled}
              onValueChange={setMembershipFreezeEnabled}
              disabled={!canEdit}
              trackColor={{ false: t.overlayBorder, true: t.brand }}
              thumbColor="#f4ffff"
            />
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>{tStr('gym_config_membership_freeze_max_label')}</Text>
          <TextInput
            style={styles.input}
            value={membershipFreezeMaxDays}
            onChangeText={setMembershipFreezeMaxDays}
            placeholder={tStr('gym_config_membership_freeze_max_ph')}
            placeholderTextColor={t.placeholder}
            editable={canEdit}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>{tStr('gym_config_membership_freeze_max_hint')}</Text>
        </View>
        ) : null}

        {gymConfigTab === 'invites' ? (
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
        ) : null}

        {gymConfigTab === 'directory' ? (
          <View style={styles.block}>
            <Text style={styles.hint}>{tStr('gym_config_directory_intro')}</Text>
            {canEdit &&
            publicDirectoryEnabled &&
            organization?.features?.public_directory_terms_v1 &&
            !directoryListingTermsComplete(organization, PUBLIC_DIRECTORY_TERMS_DOC_VERSION) ? (
              <Text style={[styles.hint, { marginTop: 12, color: '#fbbf24', fontWeight: '700' }]}>
                {tStr('gym_config_public_directory_reaccept_banner')}
              </Text>
            ) : null}
            {canEdit ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() =>
                    !(
                      publicDirectoryEnabled &&
                      directoryListingTermsComplete(organization, PUBLIC_DIRECTORY_TERMS_DOC_VERSION)
                    ) && setPublicDirectoryTermsAck((v) => !v)
                  }
                  activeOpacity={0.75}
                  disabled={
                    !!publicDirectoryEnabled &&
                    directoryListingTermsComplete(organization, PUBLIC_DIRECTORY_TERMS_DOC_VERSION)
                  }
                  style={{ marginRight: 10, marginTop: 2 }}
                >
                  <Ionicons
                    name={publicDirectoryTermsAck ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={
                      publicDirectoryEnabled &&
                      directoryListingTermsComplete(organization, PUBLIC_DIRECTORY_TERMS_DOC_VERSION)
                        ? t.subText
                        : publicDirectoryTermsAck
                          ? t.brand
                          : t.subText
                    }
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.hint,
                      {
                        opacity:
                          publicDirectoryEnabled &&
                          directoryListingTermsComplete(organization, PUBLIC_DIRECTORY_TERMS_DOC_VERSION)
                            ? 0.75
                            : 1,
                      },
                    ]}
                  >
                    {tStr('gym_config_public_directory_terms_label')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 8, gap: 4 }}>
                    <Pressable onPress={openFitEngineTerms} hitSlop={6}>
                      <Text style={{ color: t.brand, fontSize: MOBILE_TYPE.label, fontWeight: '700', textDecorationLine: 'underline' }}>
                        {tStr('gym_config_public_directory_link_terms')}
                      </Text>
                    </Pressable>
                    <Text style={{ color: t.subText, fontSize: MOBILE_TYPE.label }}>·</Text>
                    <Pressable onPress={openFitEnginePrivacy} hitSlop={6}>
                      <Text style={{ color: t.brand, fontSize: MOBILE_TYPE.label, fontWeight: '700', textDecorationLine: 'underline' }}>
                        {tStr('gym_config_public_directory_link_privacy')}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.hint, { marginTop: 6, fontSize: MOBILE_TYPE.caption }]}>
                    {tStr('gym_config_public_directory_terms_version').replace(
                      '{{version}}',
                      String(organization?.features?.public_directory_terms_doc_version || PUBLIC_DIRECTORY_TERMS_DOC_VERSION),
                    )}
                  </Text>
                </View>
              </View>
            ) : null}
            {publicDirectoryEnabled &&
            organization?.features?.public_directory_terms_v1 &&
            typeof organization.features.public_directory_terms_v1 === 'string' ? (
              <Text style={[styles.hint, { marginTop: 8, fontSize: MOBILE_TYPE.caption }]}>
                {tStr('gym_config_public_directory_terms_saved_hint').replace(
                  '{{date}}',
                  String(organization.features.public_directory_terms_v1).slice(0, 10),
                )}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>
                {tStr('gym_config_public_listing_label')}
              </Text>
              <Switch
                value={publicDirectoryEnabled}
                onValueChange={canEdit ? onTogglePublicDirectory : undefined}
                disabled={!canEdit}
              />
            </View>
            <Text style={[styles.hint, { marginTop: 8 }]}>{tStr('gym_config_public_listing_hint')}</Text>

            <Text style={[styles.label, { marginTop: 18 }]}>{tStr('gym_config_google_place_search_label')}</Text>
            <Text style={styles.hint}>{tStr('gym_config_google_place_search_hint')}</Text>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={placeAutocompleteQuery}
              onChangeText={setPlaceAutocompleteQuery}
              placeholder={tStr('gym_config_google_place_search_placeholder')}
              placeholderTextColor={t.placeholder}
              editable={canEdit}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {placeAutocompleteLoading ? (
              <View style={{ marginTop: 8 }}>
                <ActivityIndicator size="small" color={t.brand} />
              </View>
            ) : null}
            {placePredictions.length > 0 ? (
              <View
                style={{
                  marginTop: 8,
                  borderRadius: MOBILE_RADII.sm,
                  borderWidth: 1,
                  borderColor: t.overlayBorder,
                  backgroundColor: t.inputBg,
                  overflow: 'hidden',
                }}
              >
                {placePredictions.map((pred, idx) => (
                  <TouchableOpacity
                    key={`${pred.place_id}-${idx}`}
                    onPress={() => onPickPlacePrediction(pred)}
                    activeOpacity={0.78}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderBottomWidth: idx === placePredictions.length - 1 ? 0 : 1,
                      borderBottomColor: t.overlayBorder,
                    }}
                  >
                    <Text style={{ color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '700' }} numberOfLines={2}>
                      {pred.main_text || pred.description}
                    </Text>
                    {pred.secondary_text ? (
                      <Text style={{ color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 2 }} numberOfLines={2}>
                        {pred.secondary_text}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={[styles.label, { marginTop: 18 }]}>{tStr('gym_config_google_place_id_label')}</Text>
            <Text style={styles.hint}>{tStr('gym_config_google_place_id_hint')}</Text>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={googlePlaceId}
              onChangeText={setGooglePlaceId}
              placeholder="ChIJ..."
              placeholderTextColor={t.placeholder}
              editable={canEdit}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {canEdit ? (
              <TouchableOpacity
                style={[styles.logoBtn, { marginTop: 12 }]}
                onPress={syncGooglePlaceSummary}
                disabled={placeSyncBusy || saving}
                activeOpacity={0.85}
              >
                {placeSyncBusy ? (
                  <ActivityIndicator size="small" color={t.brand} />
                ) : (
                  <Text style={styles.logoBtnText}>{tStr('gym_config_sync_google_cta')}</Text>
                )}
              </TouchableOpacity>
            ) : null}
            {organization?.google_place_summary &&
            typeof organization.google_place_summary === 'object' ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.label}>{tStr('gym_config_google_summary_label')}</Text>
                <Text style={[styles.hint, { marginTop: 6 }]}>
                  {organization.google_place_summary.fetched_at
                    ? String(organization.google_place_summary.fetched_at)
                    : '—'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {gymConfigTab === 'appearance' ? (
          <>
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
                  { paddingVertical: 10, paddingHorizontal: 12, borderRadius: MOBILE_RADII.compact, borderWidth: 1, borderColor: t.overlayBorder, marginRight: 8, marginBottom: 8 },
                  themePreset === preset && { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.15) },
                ]}
              >
                <Text style={{ color: themePreset === preset ? t.brand : t.subText, fontSize: MOBILE_TYPE.label, fontWeight: '700' }}>
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
                    borderRadius: MOBILE_RADII.xxs,
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
              <Text style={{ color: token.text, fontSize: MOBILE_TYPE.subhead, fontWeight: '800', marginBottom: 3 }}>
                {tStr('gym_preview_main_title')}
              </Text>
              <Text style={{ color: token.subText, fontSize: MOBILE_TYPE.label, marginBottom: 10 }}>
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
                    borderRadius: MOBILE_RADII.compact,
                    borderWidth: 1,
                    borderColor: token.overlayBorder,
                    backgroundColor: token.inactiveTabBg,
                  }}
                >
                  <Text style={{ color: token.subText, fontSize: MOBILE_TYPE.meta }}>{tStr('gym_preview_card')}</Text>
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
          </>
        ) : null}

        {gymConfigTab === 'branding' ? (
          <>
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

        <View style={styles.block}>
          <Text style={styles.label}>{tStr('gym_config_bg_type_label')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['solid', 'gradient', 'image'].map((bt) => (
              <TouchableOpacity
                key={bt}
                onPress={() => canEdit && setBackgroundType(bt)}
                style={[
                  { paddingVertical: 8, paddingHorizontal: 12, borderRadius: MOBILE_RADII.compact, borderWidth: 1, borderColor: t.overlayBorder },
                  backgroundType === bt && { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.15) },
                ]}
              >
                <Text style={{ color: backgroundType === bt ? t.brand : t.subText, fontSize: MOBILE_TYPE.label }}>{tStr(`gym_bg_type_${bt}`)}</Text>
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
          </>
        ) : null}

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
        <View style={{ width: '100%', alignItems: 'center', marginTop: 32, paddingVertical: 20 }}>
          <LogoCompleto height={30} style={{ marginBottom: 6 }} />
          <Text style={[styles.hint, { fontSize: MOBILE_TYPE.meta, opacity: 0.8 }]}>{tStr('gym_config_footer')}</Text>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
