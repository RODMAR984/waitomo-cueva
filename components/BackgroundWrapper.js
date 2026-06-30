// components/BackgroundWrapper.js - VERSIÓN CON ROTACIÓN + #20b branding multi-org
// Si la org (no Waitomo) tiene background_type/background_url, los usa. Waitomo = comportamiento fijo.
import React from 'react';
import { ImageBackground, View, StyleSheet, Dimensions, Platform } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { useThemeContext } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { isWaitomoOrg, hexToRgba, usesFitEnginePlatformShell } from '../theme/colors';
import { FITENGINE_APP_CANVAS_BG } from '../theme/appVisualCohesion';
import {
  IMAGENES_POR_PLAN as planImages,
  IMAGEN_WELCOME as welcomeImage,
} from '../utils/imagenesFijas';
import { SCREEN_ROOT } from '../utils/screenLayout';

/** Uso interno: importar ScreenShell desde pantallas. */

/** En web: imagen fija al viewport (no “socalo” al scrollear) + contenedor transparente. */
const WEB_FULL_BLEED =
  Platform.OS === 'web'
    ? {
        width: '100%',
        alignSelf: 'stretch',
        flex: 1,
        minHeight: '100dvh',
        backgroundColor: 'transparent',
      }
    : null;
const WEB_IMAGE_COVER =
  Platform.OS === 'web'
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100dvh',
        minWidth: '100%',
        minHeight: '100%',
        objectFit: 'cover',
        objectPosition: 'center top',
        zIndex: -1,
      }
    : null;

function webImageBgProps(style, imageStyle, bgColor) {
  return {
    style: [styles.flex, WEB_FULL_BLEED, bgColor ? { backgroundColor: bgColor } : null, style].filter(Boolean),
    imageStyle: [imageStyle, WEB_IMAGE_COVER].filter(Boolean),
  };
}

const IMAGEN_PLAN_SELECTOR = require('../assets/plan_image/bg_plan_selector.jpg');
/** Directorio público “buscar gym”: misma referencia visual que PublicDirectoryScreen. */
const BG_PUBLIC_DIRECTORY = require('../assets/plan_image/bg_fitengine_public_directory.jpg');
const BG_FITENGINE_FALLBACK = require('../assets/plan_image/bg_fallback.jpg');
/** Shell FitEngine: triángulo sobre negro, pantalla completa (no watermark encima). */
const BG_FITENGINE_TRIANGLE = require('../assets/triangulo-ab.png');

/**
 * Shell FitEngine (org sin branding propio): solo 3 fotos de producto, rotación por pantalla/usuario/org.
 * Sin LogoTriangleBackground superpuesto — el triángulo es una de las tres imágenes de fondo.
 */
const FITENGINE_PLATFORM_SHELL_BACKGROUNDS = [
  BG_PUBLIC_DIRECTORY,
  BG_FITENGINE_FALLBACK,
  BG_FITENGINE_TRIANGLE,
].filter(Boolean);

function pickFitEngineShellBackgroundSource({ screenLower, userId, orgId }) {
  const arr = FITENGINE_PLATFORM_SHELL_BACKGROUNDS;
  if (!arr.length) return BG_PUBLIC_DIRECTORY;
  const s = `${String(screenLower || '')}|${String(userId || '')}|${String(orgId || '')}`;
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return arr[Math.abs(h) % arr.length];
}

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
  // CreateAccount / CreaCuentaStaff (screen="Welcome") — stock app, no white-label org.
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
  const { t, isDark } = useThemeContext();
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
  /**
   * Triángulo centrado detrás del velo: con paneles neo semitransparentes (Engine room, config gym, etc.)
   * se percibe como columna oscura vertical. Ocultarlo en back-office staff; en cliente in-app se mantiene.
   */
  const isFePlatformShellOrg =
    !!orgForBackground?.id && usesFitEnginePlatformShell(orgForBackground);
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
      <View style={[styles.flex, style, { backgroundColor: FITENGINE_APP_CANVAS_BG }]}>
        <View style={styles.contentChild}>{children}</View>
      </View>
    );
  }

  // Fondo explícito (p. ej. clase de prueba / formularios con rotación general)
  if (fondo) {
    const bgProps = webImageBgProps(style, imageStyle);
    return (
      <ImageBackground
        source={fondo}
        style={bgProps.style}
        imageStyle={bgProps.imageStyle}
        resizeMode="cover"
      >
        <View style={overlayStyle} />
        <View style={styles.contentChild}>{children}</View>
      </ImageBackground>
    );
  }

  // #20b: org no-Waitomo con fondo custom — solid o image
  if (useOrgBackground && orgBgType === 'solid') {
    if (usesFitEnginePlatformShell(orgForBackground)) {
      const feSolidShellSource = pickFitEngineShellBackgroundSource({
        screenLower,
        userId: user?.id,
        orgId: orgForBackground?.id,
      });
      const bgProps = webImageBgProps(style, imageStyle, t.bg);
      return (
        <ImageBackground
          source={feSolidShellSource}
          style={bgProps.style}
          imageStyle={bgProps.imageStyle}
          resizeMode="cover"
        >
          <View style={overlayStyle} />
          <View style={styles.contentChild}>{children}</View>
        </ImageBackground>
      );
    }
    return (
      <View style={[styles.flex, style, { backgroundColor: t.bg }]}>
        <View style={styles.contentChild}>{children}</View>
      </View>
    );
  }
  // Velo fuerte: fotos muy claras/blancas no “apagan” la UI encima
  const orgImageScrim = 'rgba(0,0,0,0.58)';
  const orgImageScrimStyle = { ...StyleSheet.absoluteFillObject, backgroundColor: orgImageScrim };

  if (useOrgBackground && orgBgType === 'image' && orgBgUrl) {
    const bgProps = webImageBgProps(style, imageStyle);
    return (
      <ImageBackground
        source={{ uri: orgBgUrl }}
        style={bgProps.style}
        imageStyle={bgProps.imageStyle}
        resizeMode="cover"
      >
        <View style={orgImageScrimStyle} />
        <View style={overlayStyle} />
        <View style={styles.contentChild}>{children}</View>
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
        <View style={styles.contentChild}>{children}</View>
      </View>
    );
  }

  // Configuración del gym: fallback plano (Waitomo, sin URL de imagen, etc.) — después de intentar fondo org.
  if (screenLower === 'gymconfig') {
    return (
      <View style={[styles.flex, style, { backgroundColor: t.bg }]}>
        <View style={styles.contentChild}>{children}</View>
      </View>
    );
  }

  // Directorio público: siempre la imagen “buscar gym” (no el pool rotativo del shell FitEngine).
  if (screenLower === 'publicdirectory') {
    const webFullBleed =
      Platform.OS === 'web'
        ? {
            width: '100%',
            alignSelf: 'stretch',
            minHeight: '100%',
            backgroundColor: '#0a0d10',
          }
        : null;
    const webImageCover =
      Platform.OS === 'web'
        ? {
            width: '100%',
            minWidth: '100%',
            minHeight: '100%',
            objectFit: 'cover',
          }
        : null;
    return (
      <ImageBackground
        source={BG_PUBLIC_DIRECTORY}
        style={[styles.flex, style, webFullBleed]}
        imageStyle={[imageStyle, webImageCover].filter(Boolean)}
        resizeMode="cover"
      >
        <View style={overlayStyle} />
        <View style={styles.contentChild}>{children}</View>
      </ImageBackground>
    );
  }

  const feShellSourceAuth = pickFitEngineShellBackgroundSource({
    screenLower,
    userId: user?.id,
    orgId: orgForBackground?.id,
  });

  // Intro / branding FitEngine: mismo pool de 3 fondos (sin watermark).
  if (screenLower === 'fitenginespaceintro' || screenLower === 'configuratuespacio') {
    const bgProps = webImageBgProps(style, imageStyle, t.bg);
    return (
      <ImageBackground
        source={feShellSourceAuth}
        style={bgProps.style}
        imageStyle={bgProps.imageStyle}
        resizeMode="cover"
      >
        <View style={overlayStyle} />
        <View style={styles.contentChild}>{children}</View>
      </ImageBackground>
    );
  }

  // PRIMERO: TRABAJO DEL DIA Y ADMIN — si hay sesión pero `organization` aún null (fetch / carrera), no mostrar
  // la rotación stock Waitomo: fondo plano con tokens de tema (ThemeContext ya suaviza con última org).
  if (isTrabajoODiaOAdmin) {
    if (user?.id && !organization?.id) {
      return (
        <View style={[styles.flex, style, { backgroundColor: t.bg }]}>
          <View style={styles.contentChild}>{children}</View>
        </View>
      );
    }
    if (isFePlatformShellOrg) {
      const feShellSource = pickFitEngineShellBackgroundSource({
        screenLower,
        userId: user?.id,
        orgId: orgForBackground?.id,
      });
      const bgProps = webImageBgProps(style, imageStyle, t.bg);
      return (
        <ImageBackground
          source={feShellSource}
          style={bgProps.style}
          imageStyle={bgProps.imageStyle}
          resizeMode="cover"
        >
          <View style={overlayStyle} />
          <View style={styles.contentChild}>{children}</View>
        </ImageBackground>
      );
    }
    const source = TRABAJO_DIA_BACKGROUNDS[randomIndex];
    const bgProps = webImageBgProps(style, imageStyle);

    return (
      <ImageBackground
        source={source}
        style={bgProps.style}
        imageStyle={bgProps.imageStyle}
        resizeMode="cover"
      >
        <View style={overlayStyle} />
        <View style={styles.contentChild}>{children}</View>
      </ImageBackground>
    );
  }

  // SEGUNDO: pantalla específica con imagen propia (selector de planes)
  if (screenLower.includes('planselector')) {
    const bgProps = webImageBgProps(style, imageStyle);
    return (
      <ImageBackground
        source={IMAGEN_PLAN_SELECTOR}
        style={bgProps.style}
        imageStyle={bgProps.imageStyle}
        resizeMode="cover"
      >
        <View style={overlayStyle} />
        <View style={styles.contentChild}>{children}</View>
      </ImageBackground>
    );
  }

  // FINALMENTE: imagen por plan; si no hay plan o no hay imagen, fondo Welcome (flujo crear cuenta/pago/perfil)
  const key = getPlanKey(plan);
  const source = isWelcome ? welcomeImage : (planImages[key] || welcomeImage);

  if (!source) {
    return (
      <View style={[styles.flex, style, { backgroundColor: t.bg }]}>
        <View style={styles.contentChild}>{children}</View>
      </View>
    );
  }

  // Welcome: zoom ligero
  const bgProps = webImageBgProps(style, imageStyle);
  return (
    <ImageBackground
      source={source}
      style={bgProps.style}
      imageStyle={bgProps.imageStyle}
      resizeMode="cover"
    >
      <View style={overlayStyle} />
      <View style={styles.contentChild}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /** RN nativo: sin flex:1 el contenido dentro de ImageBackground colapsa a altura 0 (solo se ve el fondo). */
  contentChild: {
    ...SCREEN_ROOT,
    ...(Platform.OS === 'web'
      ? {
          width: '100%',
          alignSelf: 'stretch',
          position: 'relative',
          zIndex: 1,
          minHeight: '100%',
        }
      : null),
  },
});
