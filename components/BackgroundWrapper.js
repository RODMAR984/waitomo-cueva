// components/BackgroundWrapper.js - VERSIÓN CON ROTACIÓN + #20b branding multi-org
// Si la org (no Waitomo) tiene background_type/background_url, los usa. Waitomo = comportamiento fijo.
import React from 'react';
import { ImageBackground, View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { useThemeContext } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { isWaitomoOrg, hexToRgba } from '../theme/colors';
import {
  IMAGENES_POR_PLAN as planImages,
  IMAGEN_WELCOME as welcomeImage,
} from '../utils/imagenesFijas';

const IMAGEN_PLAN_SELECTOR = require('../assets/plan_image/bg_plan_selector.jpg');
/** Directorio público “buscar gym”: fondo fijo marca (cueva digital / triángulo). */
const BG_PUBLIC_DIRECTORY = require('../assets/plan_image/bg_public_directory_cave.png');

// LISTA DE TODAS LAS IMÁGENES PARA TRABAJO DEL DIA - NOMBRES EXACTOS
const TRABAJO_DIA_BACKGROUNDS = [
  require('../assets/plan_image/bg_cueva_waitomo.jpg'),
  require('../assets/plan_image/bg_fallback.jpg'),
  require('../assets/plan_image/bg_kettlebell_logo.jpg'),
  require('../assets/plan_image/bg_plan_selector.jpg'),
  require('../assets/plan_image/bg_waitomo_clean.jpg'),
  require('../assets/plan_image/bg_welcome_glow.jpg'),
  require('../assets/plan_image/bg2.jpg'),
  require('../assets/plan_image/bg3.jpg'),
  require('../assets/plan_image/bg4.jpg'),
  require('../assets/plan_image/bg5.jpg'),
  require('../assets/plan_image/bg6.jpg'),
  require('../assets/plan_image/plan_cross.jpg'),
  require('../assets/plan_image/plan_evolucion.jpg'),
  require('../assets/plan_image/plan_hyrox_1.jpg'),
  require('../assets/plan_image/plan_oly.jpg'),
  require('../assets/plan_image/plan_openbox.jpg'),
  require('../assets/plan_image/plan_stretching.jpg'),
  require('../assets/plan_image/plan_yoga.jpg'),
].filter(img => img);

/** Entrada / marketing FitEngine: no usar imagen sólida/degradado/fondo org del tenant. */
function isFitEnginePlatformBackgroundScreen(sl) {
  const s = String(sl || '').toLowerCase().trim();
  if (!s) return false;
  if (s === 'neutral' || s === 'fitengine' || s === 'fitengineglobal' || s === 'splash') return true;
  // CreateAccount / AdminLogin / CreaCuentaStaff (screen="Welcome") — stock app, no white-label org
  if (s === 'welcome') return true;
  // Listado global de gims (marketing): mismo criterio que neutral, sin fondo org del tenant.
  if (s === 'publicdirectory') return true;
  return false;
}

function getPlanKey(plan) {
  const raw =
    plan?.id ??
    plan?.nombre ??
    plan?.name ??
    plan?.title ??
    '';

  const s = String(raw).toLowerCase().trim();

  if (s.includes('cross')) return 'cross';
  if (s.includes('open')) return 'openbox';
  if (s.includes('evolu')) return 'evolucion';
  if (s.includes('stretch')) return 'stretching';
  if (s.includes('yoga')) return 'yoga';
  if (s.includes('oly') || s.includes('olímp')) return 'oly';
  if (s.includes('hyrox')) return 'hyrox';
  return '';
}

export default function BackgroundWrapper({
  children,
  plan = null,
  screen = '',
  /** Imagen de fondo explícita (`require(...)` o `{ uri }`). Tiene prioridad sobre plan/screen. */
  fondo = null,
  style,
  imageStyle,
  seed = Date.now(),
  forceDarkOverlay = false,
}) {
  const { t } = useThemeContext();
  const { organization, user } = useAuth() || {};
  /**
   * Mientras `organization` es null (fetch async o setOrganization(null) entre pasos),
   * sin esto ClientTabs/ClientScreen caen en TRABAJO_DIA_BACKGROUNDS → flash estética Waitomo.
   * Misma idea que lastOrgForThemeRef en ThemeContext.
   */
  const lastOrgForBackgroundRef = React.useRef(null);
  if (!user?.id) {
    lastOrgForBackgroundRef.current = null;
  } else if (organization?.id) {
    lastOrgForBackgroundRef.current = organization;
  }
  const orgForBackground =
    user?.id && (organization?.id ? organization : lastOrgForBackgroundRef.current);

  const screenLower = String(screen).toLowerCase().trim();
  const isWelcome = screenLower.includes('welcome');
  const overlayColor = forceDarkOverlay ? 'rgba(0,0,0,0.24)' : t.screenOverlay;
  const overlayStyle = { ...StyleSheet.absoluteFillObject, backgroundColor: overlayColor };
  const isTrabajoODiaOAdmin =
    screenLower.includes('trabajodeldia') ||
    screenLower.includes('admin') ||
    screenLower.includes('clientscreen') ||
    screenLower.includes('clienttabs');

  const useOrgBackground =
    orgForBackground &&
    !isWaitomoOrg(orgForBackground) &&
    !isFitEnginePlatformBackgroundScreen(screenLower);
  const orgBgType = useOrgBackground ? (orgForBackground.background_type || 'solid') : null;
  const orgBgUrl = useOrgBackground ? orgForBackground.background_url : null;

  // Siempre antes de cualquier return: misma cantidad de hooks en todos los renders.
  const [randomIndex] = React.useState(() => {
    if (!isTrabajoODiaOAdmin || TRABAJO_DIA_BACKGROUNDS.length === 0) return 0;
    const baseSeed = typeof seed === 'number' ? seed : Date.now();
    return Math.abs(baseSeed) % TRABAJO_DIA_BACKGROUNDS.length;
  });

  // Pantallas globales FitEngine: fondo oscuro neutro, sin imágenes de Waitomo (Fase 6)
  const isNeutralFitEngine =
    screenLower === 'neutral' || screenLower === 'fitengine' || screenLower === 'fitengineglobal';
  if (isNeutralFitEngine) {
    return (
      <View style={[styles.flex, style, { backgroundColor: '#050a0d' }]}>
        {children}
      </View>
    );
  }

  // Fondo explícito (p. ej. clase de prueba / formularios con rotación general)
  if (fondo) {
    return (
      <ImageBackground
        source={fondo}
        style={[styles.flex, style]}
        imageStyle={imageStyle}
        resizeMode="cover"
      >
        <View style={overlayStyle} />
        {children}
      </ImageBackground>
    );
  }

  // #20b: org no-Waitomo con fondo custom — solid o image
  if (useOrgBackground && orgBgType === 'solid') {
    return (
      <View style={[styles.flex, style, { backgroundColor: t.bg }]}>
        {children}
      </View>
    );
  }
  // Velo fuerte: fotos muy claras/blancas no “apagan” la UI encima
  const orgImageScrim = 'rgba(0,0,0,0.58)';
  const orgImageScrimStyle = { ...StyleSheet.absoluteFillObject, backgroundColor: orgImageScrim };

  if (useOrgBackground && orgBgType === 'image' && orgBgUrl) {
    return (
      <ImageBackground
        source={{ uri: orgBgUrl }}
        style={[styles.flex, style]}
        imageStyle={imageStyle}
        resizeMode="cover"
      >
        <View style={orgImageScrimStyle} />
        <View style={overlayStyle} />
        {children}
      </ImageBackground>
    );
  }
  if (useOrgBackground && orgBgType === 'gradient') {
    const accent = orgForBackground?.accent_color || '#818cf8';
    const { width: gw, height: gh } = Dimensions.get('window');
    const gradId = `orgGrad-${String(orgForBackground?.id || 'x').replace(/[^a-zA-Z0-9]/g, '')}`;
    return (
      <View style={[styles.flex, style]}>
        <Svg width={gw} height={gh} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accent} stopOpacity="1" />
              <Stop offset="1" stopColor={hexToRgba(accent, 0.35)} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect width={gw} height={gh} fill={`url(#${gradId})`} />
        </Svg>
        <View style={overlayStyle} />
        {children}
      </View>
    );
  }

  // Configuración del gym: fallback plano (Waitomo, sin URL de imagen, etc.) — después de intentar fondo org.
  if (screenLower === 'gymconfig') {
    return (
      <View style={[styles.flex, style, { backgroundColor: t.bg }]}>
        {children}
      </View>
    );
  }

  // Directorio público (onboarding FitEngine): imagen fija + velo para legibilidad (sin rotación Waitomo).
  if (screenLower === 'publicdirectory') {
    return (
      <ImageBackground
        source={BG_PUBLIC_DIRECTORY}
        style={[styles.flex, style]}
        resizeMode="cover"
      >
        <View style={overlayStyle} />
        {children}
      </ImageBackground>
    );
  }

  // PRIMERO: TRABAJO DEL DIA Y ADMIN — si hay sesión pero `organization` aún null (fetch / carrera), no mostrar
  // la rotación stock Waitomo: fondo plano con tokens de tema (ThemeContext ya suaviza con última org).
  if (isTrabajoODiaOAdmin) {
    if (user?.id && !organization?.id) {
      return (
        <View style={[styles.flex, style, { backgroundColor: t.bg }]}>
          {children}
        </View>
      );
    }
    const source = TRABAJO_DIA_BACKGROUNDS[randomIndex];

    return (
      <ImageBackground
        source={source}
        style={[styles.flex, style]}
        imageStyle={imageStyle}
        resizeMode="cover"
      >
        <View style={overlayStyle} />
        {children}
      </ImageBackground>
    );
  }

  // SEGUNDO: pantalla específica con imagen propia (selector de planes)
  if (screenLower.includes('planselector')) {
    return (
      <ImageBackground
        source={IMAGEN_PLAN_SELECTOR}
        style={[styles.flex, style]}
        imageStyle={imageStyle}
        resizeMode="cover"
      >
        <View style={overlayStyle} />
        {children}
      </ImageBackground>
    );
  }

  // FINALMENTE: imagen por plan; si no hay plan o no hay imagen, fondo Welcome (flujo crear cuenta/pago/perfil)
  const key = getPlanKey(plan);
  const source = isWelcome ? welcomeImage : (planImages[key] || welcomeImage);

  if (!source) {
    return (
      <View style={[styles.flex, style, { backgroundColor: t.bg }]}>
        {children}
      </View>
    );
  }

  // Welcome: zoom ligero en la imagen para efecto “recortado” (mano + kettlebell más protagonistas)
  return (
    <ImageBackground
      source={source}
      style={[styles.flex, style]}
      imageStyle={imageStyle}
      resizeMode="cover"
    >
      <View style={overlayStyle} />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
