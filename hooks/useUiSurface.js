import { Platform, useWindowDimensions } from 'react-native';
import { WEB_DESKTOP_BREAKPOINT } from '../theme/webSpec';

/** @typedef {'native' | 'mobileWeb' | 'desktopWeb'} UiSurface */

/**
 * Superficie UI sin hook (tests, SSR, lógica fuera de componentes).
 * @param {number} width
 * @param {string} [platform]
 * @returns {UiSurface}
 */
export function getUiSurface(width, platform = Platform.OS) {
  if (platform !== 'web') return 'native';
  return width >= WEB_DESKTOP_BREAKPOINT ? 'desktopWeb' : 'mobileWeb';
}

/**
 * Detecta superficie: nativo, web móvil (Safari iPhone, etc.) o web escritorio.
 * Reemplaza `Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT` disperso en pantallas.
 */
export default function useUiSurface() {
  const { width, height } = useWindowDimensions();
  const surface = getUiSurface(width);

  return {
    surface,
    width,
    height,
    isNative: surface === 'native',
    isMobileWeb: surface === 'mobileWeb',
    isDesktopWeb: surface === 'desktopWeb',
    /** @deprecated preferir isDesktopWeb */
    isWebDesktop: surface === 'desktopWeb',
    isWeb: Platform.OS === 'web',
  };
}
