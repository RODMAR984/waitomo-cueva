import { Image, Platform } from 'react-native';

let installed = false;

/**
 * En `expo start --web` (Metro) el documento HTML no es el de `web/index.html` (Vite).
 * Forzamos el favicon con la URI que resuelve el bundler para el mismo PNG que app móvil.
 */
export function installWebTabFavicon() {
  if (installed) return;
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  installed = true;
  try {
    const resolved = Image.resolveAssetSource(require('../assets/app-icon-composite.png'));
    const href = resolved && resolved.uri;
    if (!href) return;
    document
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .forEach((el) => el.remove());
    const add = (rel, sizes) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.type = 'image/png';
      if (sizes) link.setAttribute('sizes', sizes);
      link.href = href;
      document.head.appendChild(link);
    };
    add('icon', '32x32');
    add('icon', '192x192');
    add('icon', '512x512');
    add('apple-touch-icon', '180x180');
  } catch (_) {
    installed = false;
  }
}
