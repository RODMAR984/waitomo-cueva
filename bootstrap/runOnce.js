/**
 * Efectos de arranque que deben ejecutarse una vez al cargar el bundle (antes del árbol React).
 */
import { Image, Platform } from 'react-native';
import { registerGeneralImages } from '../utils/getRandomGeneralImage';
import { IMAGENES_POR_PLAN, IMAGEN_WELCOME } from '../utils/imagenesFijas';
import { initSentryWebFromEnv } from '../utils/sentryWebClient';
import { initWebVitalsReporting } from '../utils/webVitals';
import { applyWebViewportCanvas } from '../utils/webViewportCanvas';

export function runAppBootstrapOnce() {
  initSentryWebFromEnv();
  initWebVitalsReporting();
  if (Platform.OS === 'web') {
    applyWebViewportCanvas();
  }

  Object.values(IMAGENES_POR_PLAN).forEach((image) => {
    if (image && typeof image === 'number') {
      const imageSource = Image.resolveAssetSource(image);
      if (imageSource?.uri) Image.prefetch(imageSource.uri);
    }
  });

  if (IMAGEN_WELCOME && typeof IMAGEN_WELCOME === 'number') {
    const welcomeSource = Image.resolveAssetSource(IMAGEN_WELCOME);
    if (welcomeSource?.uri) Image.prefetch(welcomeSource.uri);
  }

  registerGeneralImages([
    IMAGEN_WELCOME,
    IMAGENES_POR_PLAN.cross,
    IMAGENES_POR_PLAN.openbox,
    IMAGENES_POR_PLAN.evolucion,
    IMAGENES_POR_PLAN.stretching,
    IMAGENES_POR_PLAN.yoga,
    IMAGENES_POR_PLAN.hyrox,
    IMAGENES_POR_PLAN.oly,
  ]);
}
