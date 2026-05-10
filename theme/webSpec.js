import { MOBILE_RADII } from './mobileSpec';

export const WEB_DESKTOP_BREAKPOINT = 1100;
/** Rail cliente web: ancho fijo para etiquetas (Panel / Calendario / Perfil) sin apretar. */
export const WEB_RAIL_WIDTH = 272;
/** Tope del bloque novedades bajo las tabs (el alto real se acota también al viewport en ClientTabs). */
export const WEB_RAIL_NOVEDADES_MAX_HEIGHT_CAP = 328;

export const WEB_CONTENT_MAX_WIDTH = 1040;

/** Radio de paneles/tarjetas: mismo valor que `MOBILE_RADII.lg` (única fuente de verdad). */
export const WEB_PANEL_RADIUS = MOBILE_RADII.lg;
export const WEB_PANEL_PADDING_DESKTOP = 20;
export const WEB_PANEL_PADDING_MOBILE = 16;
