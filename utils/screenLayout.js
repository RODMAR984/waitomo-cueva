import { Platform } from 'react-native';

/**
 * Contrato de layout FitEngine — una sola fuente de verdad para flex/scroll en todas las pantallas.
 * Usar con `useUiSurface()` para reglas que dependen de escritorio vs móvil web vs nativo.
 */

/** Contenedor raíz dentro del fondo (tabs, stacks, KAV). */
export const SCREEN_ROOT = Object.freeze({ flex: 1, minHeight: 0 });

/** ScrollView / FlatList que debe llenar el espacio disponible. */
export const SCREEN_FILL = SCREEN_ROOT;

/**
 * @param {'native' | 'mobileWeb' | 'desktopWeb'} surface
 * @param {object | object[] | null | undefined} [extra]
 */
export function scrollContentContainer(surface, extra) {
  const base =
    surface === 'desktopWeb'
      ? { flexGrow: 0, flexShrink: 0 }
      : { flexGrow: 1 };

  if (!extra) return base;
  return Array.isArray(extra) ? [base, ...extra] : [base, extra];
}

/** @param {'native' | 'mobileWeb' | 'desktopWeb'} surface */
export function isDesktopWebSurface(surface) {
  return surface === 'desktopWeb';
}

/**
 * @deprecated Usar scrollContentContainer(surface). Mantenido para imports legacy.
 * Solo escritorio web: evita scroll vacío que deja ver el canvas #021b23.
 */
export const WEB_SCROLL_NO_STRETCH =
  Platform.OS === 'web' ? { flexGrow: 0, flexShrink: 0 } : null;
