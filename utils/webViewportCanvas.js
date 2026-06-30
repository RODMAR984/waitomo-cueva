/** Mismo tono que `app.json` → `expo.web.backgroundColor`. */
export const WEB_VIEWPORT_CANVAS_BG = '#021b23';

/** @deprecated Importar desde `utils/screenLayout` + `scrollContentContainer(surface)`. */
export { WEB_SCROLL_NO_STRETCH } from './screenLayout';

/**
 * Evita franjas blancas en los bordes del viewport cuando el árbol RN no cubre el 100% del ancho.
 */
export function applyWebViewportCanvas() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const css = `
    html, body, #root {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100%;
      min-height: 100dvh;
      background-color: ${WEB_VIEWPORT_CANVAS_BG};
      overflow-x: hidden;
      overscroll-behavior-y: none;
    }
  `;

  let el = document.getElementById('fitengine-web-viewport-canvas');
  if (!el) {
    el = document.createElement('style');
    el.id = 'fitengine-web-viewport-canvas';
    document.head.appendChild(el);
  }
  el.textContent = css;
}
