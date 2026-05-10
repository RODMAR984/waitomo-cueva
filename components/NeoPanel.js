// Borde panel más vivo (cian neo) + halo suave; en web animación tipo “haz” vía CSS.
import React, { useEffect, useMemo } from 'react';
import { View, Platform } from 'react-native';
import { useThemeContext } from '../contexts/ThemeContext';
import { hexToRgba } from '../theme/colors';
import { MOBILE_RADII, MOBILE_SPACING } from '../theme/mobileSpec';

export const FITENGINE_NEO_PANEL_CLASS = 'fitengine-neo-panel';
export const FITENGINE_NEO_PANEL_SPARK_CLASS = 'fitengine-neo-panel--spark';

/** Haz que “corre” por el perímetro: sombras externas desplazadas (sin rellenos ni conic). */
export function ensureNeoPanelWebCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const id = 'fitengine-neo-panel-css';
  const el = document.getElementById(id) || document.createElement('style');
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
@keyframes fitengine-neo-spark-orbit {
  0% {
    box-shadow:
      0 -10px 18px rgba(220, 255, 255, 0.85),
      0 0 6px rgba(0, 245, 255, 0.35),
      inset 0 0 0 1px rgba(0, 245, 255, 0.12);
    border-color: rgba(0, 245, 255, 0.5) !important;
  }
  25% {
    box-shadow:
      10px 0 18px rgba(220, 255, 255, 0.85),
      0 0 6px rgba(0, 245, 255, 0.35),
      inset 0 0 0 1px rgba(0, 245, 255, 0.12);
    border-color: rgba(0, 245, 255, 0.65) !important;
  }
  50% {
    box-shadow:
      0 10px 18px rgba(220, 255, 255, 0.85),
      0 0 6px rgba(0, 245, 255, 0.35),
      inset 0 0 0 1px rgba(0, 245, 255, 0.12);
    border-color: rgba(0, 245, 255, 0.65) !important;
  }
  75% {
    box-shadow:
      -10px 0 18px rgba(220, 255, 255, 0.85),
      0 0 6px rgba(0, 245, 255, 0.35),
      inset 0 0 0 1px rgba(0, 245, 255, 0.12);
    border-color: rgba(0, 245, 255, 0.65) !important;
  }
  100% {
    box-shadow:
      0 -10px 18px rgba(220, 255, 255, 0.85),
      0 0 6px rgba(0, 245, 255, 0.35),
      inset 0 0 0 1px rgba(0, 245, 255, 0.12);
    border-color: rgba(0, 245, 255, 0.5) !important;
  }
}
.${FITENGINE_NEO_PANEL_CLASS} {
  animation: fitengine-neo-sweep 3.5s ease-in-out infinite;
}
.${FITENGINE_NEO_PANEL_SPARK_CLASS} {
  position: relative;
  overflow: visible;
  animation: fitengine-neo-spark-orbit 2.6s linear infinite;
}
`;
  if (!el.parentNode) document.head.appendChild(el);
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
    shadowOpacity: spark ? 0.34 : 0.24,
    shadowRadius: spark ? MOBILE_RADII.lg + 2 : MOBILE_RADII.lg,
    elevation: spark ? 8 : 7,
  };
}

/**
 * Contenedor de panel principal: borde un poco más grueso + cian neo; en web suma pulso (CSS).
 * @param {boolean} [spark] — Web: haz claro que orbita el borde (box-shadow). Nativo: halo un poco más marcado.
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
