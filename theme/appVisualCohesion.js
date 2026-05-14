/**
 * Capa visual mínima compartida: auth marketing / login / signup staff
 * leen como la misma app FitEngine. No sustituye tokens de tema por org (cliente/admin).
 */
import { Platform } from 'react-native';
import { fitengineLogoColors } from './colors';
import { MOBILE_RADII, MOBILE_SPACING } from './mobileSpec';

export const FITENGINE_APP_CANVAS_BG = fitengineLogoColors.background;

/** Contenedor detrás del triángulo (mismo canvas que Login). */
export const authMarketingChromeRoot = {
  flex: 1,
  backgroundColor: FITENGINE_APP_CANVAS_BG,
  overflow: 'hidden',
};

/**
 * Panel “glass” unificado — usar con `<NeoPanel edge={false} style={[styles.extra, authSoftPanelStyle]} />`
 * o spread dentro de StyleSheet.create.
 */
export const authSoftPanelStyle = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  borderColor: 'rgba(134, 196, 199, 0.32)',
  borderRadius: MOBILE_RADII.lg,
  borderWidth: 1,
  padding: MOBILE_SPACING.xl,
  width: '100%',
  ...Platform.select({
    web: { boxShadow: '0 8px 32px rgba(0,0,0,0.25)' },
    default: {},
  }),
};
