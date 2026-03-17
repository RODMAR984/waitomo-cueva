// components/BackgroundWrapper.js - VERSIÓN CON ROTACIÓN PARA TRABAJO DEL DIA + ADMIN
// forceDarkOverlay: solo WelcomeScreen lo pasa; Login y demás respetan el tema.
import React from 'react';
import { ImageBackground, View, StyleSheet } from 'react-native';
import { useThemeContext } from '../contexts/ThemeContext';
import {
  IMAGENES_POR_PLAN as planImages,
  IMAGEN_WELCOME as welcomeImage,
} from '../utils/imagenesFijas';

const IMAGEN_PLAN_SELECTOR = require('../assets/plan_image/bg_plan_selector.jpg');

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
  style,
  imageStyle,
  seed = Date.now(),
  forceDarkOverlay = false,
}) {
  const { t } = useThemeContext();
  const screenLower = String(screen).toLowerCase().trim();
  const isWelcome = screenLower.includes('welcome');
  const overlayColor = forceDarkOverlay ? 'rgba(0,0,0,0.24)' : t.screenOverlay;
  const overlayStyle = { ...StyleSheet.absoluteFillObject, backgroundColor: overlayColor };
  const isTrabajoODiaOAdmin =
    screenLower.includes('trabajodeldia') ||
    screenLower.includes('admin') ||
    screenLower.includes('clientscreen') ||
    screenLower.includes('clienttabs');

  // Elegimos índice aleatorio SOLO una vez por montaje
  const [randomIndex] = React.useState(() => {
    if (!isTrabajoODiaOAdmin || TRABAJO_DIA_BACKGROUNDS.length === 0) return 0;
    const baseSeed = typeof seed === 'number' ? seed : Date.now();
    return Math.abs(baseSeed) % TRABAJO_DIA_BACKGROUNDS.length;
  });

  // PRIMERO: TRABAJO DEL DIA Y ADMIN - ROTACIÓN ENTRE TODAS LAS IMÁGENES
  if (isTrabajoODiaOAdmin) {
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
    return <View style={[styles.flex, style]}>{children}</View>;
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
