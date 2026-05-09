// Borde panel más vivo (cian neo) + halo suave; en web animación tipo “haz” vía CSS.
import React, { useEffect, useMemo } from 'react';
import { View, Platform } from 'react-native';
import { useThemeContext } from '../contexts/ThemeContext';
import { hexToRgba } from '../theme/colors';
import { MOBILE_RADII, MOBILE_SPACING } from '../theme/mobileSpec';

export const FITENGINE_NEO_PANEL_CLASS = 'fitengine-neo-panel';
export const FITENGINE_NEO_PANEL_SPARK_CLASS = 'fitengine-neo-panel--spark';

let cssInjected = false;

export function ensureNeoPanelWebCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || cssInjected) return;
  const id = 'fitengine-neo-panel-css';
  if (document.getElementById(id)) return;
  cssInjected = true;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = `
@keyframes fitengine-neo-sweep {
  0%, 100% {
    box-shadow: 0 0 10px rgba(0, 245, 255, 0.12), inset 0 0 0 1px rgba(0, 245, 255, 0.1);
    border-color: rgba(0, 245, 255, 0.38) !important;
  }
  50% {
    box-shadow: 0 0 28px rgba(0, 245, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    border-color: rgba(0, 245, 255, 0.72) !important;
  }
}
@keyframes fitengine-neo-spark-spin {
  to { transform: rotate(360deg); }
}
.${FITENGINE_NEO_PANEL_CLASS} {
  animation: fitengine-neo-sweep 3.5s ease-in-out infinite;
}
.${FITENGINE_NEO_PANEL_SPARK_CLASS} {
  position: relative;
  overflow: visible;
  animation: fitengine-neo-sweep 2.6s ease-in-out infinite;
}
.${FITENGINE_NEO_PANEL_SPARK_CLASS}::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(from 0deg, rgba(0,245,255,0.05), rgba(0,245,255,0.85), rgba(0,245,255,0.15), rgba(0,245,255,0.05));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: fitengine-neo-spark-spin 4.2s linear infinite;
  pointer-events: none;
  z-index: 0;
}
.${FITENGINE_NEO_PANEL_SPARK_CLASS} > * {
  position: relative;
  z-index: 1;
}
`;
  document.head.appendChild(el);
}

function edgeFromBrand(brand) {
  const b = typeof brand === 'string' && brand.startsWith('#') ? brand : '#00ffff';
  return hexToRgba(b, 0.52);
}

function nativeHalo(brand, spark) {
  const glow = typeof brand === 'string' && brand.startsWith('#') ? brand : '#00ffff';
  return {
    shadowColor: glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: spark ? 0.38 : 0.24,
    shadowRadius: spark ? MOBILE_SPACING.xl : MOBILE_RADII.lg,
    elevation: spark ? 9 : 7,
  };
}

/**
 * Contenedor de panel principal: borde un poco más grueso + cian neo; en web suma pulso (CSS).
 * @param {boolean} [spark] — “mecha” más viva (web: conic-gradient; nativo: halo más fuerte).
 */
export default function NeoPanel({ style, children, spark = false, ...rest }) {
  const { t } = useThemeContext();

  useEffect(() => {
    ensureNeoPanelWebCss();
  }, []);

  const edgeStyle = useMemo(() => {
    const borderColor = edgeFromBrand(t.brand);
    if (Platform.OS === 'web') {
      return { borderWidth: spark ? 2.5 : 2, borderColor };
    }
    return {
      borderWidth: spark ? 2.5 : 2,
      borderColor,
      ...nativeHalo(t.brand, spark),
    };
  }, [t.brand, spark]);

  const webClass = [FITENGINE_NEO_PANEL_CLASS, spark ? FITENGINE_NEO_PANEL_SPARK_CLASS : '']
    .filter(Boolean)
    .join(' ');
  const webProps = Platform.OS === 'web' ? { className: webClass } : {};

  // `style` primero (padding/fondo) y `edgeStyle` después para que borde/glow neo no lo pise el panel.
  return (
    <View style={[style, edgeStyle]} {...webProps} {...rest}>
      {children}
    </View>
  );
}
