// Borde panel neo + opcional “destello” real: trazo SVG con stroke-dashoffset (web y nativo).
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Platform, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useThemeContext } from '../contexts/ThemeContext';
import { hexToRgba } from '../theme/colors';
import { MOBILE_RADII, MOBILE_SPACING } from '../theme/mobileSpec';

export const FITENGINE_NEO_PANEL_CLASS = 'fitengine-neo-panel';
/** Reservado por si algo en web lo referencia; el destello va por SVG, no por esta clase. */
export const FITENGINE_NEO_PANEL_SPARK_CLASS = 'fitengine-neo-panel--spark';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** Perímetro aproximado de rectángulo redondeado (cuatro esquinas radio r). */
function roundedRectPerimeter(w, h, r) {
  const rw = Math.max(0, w);
  const rh = Math.max(0, h);
  const rr = Math.max(0, Math.min(r, rw / 2, rh / 2));
  if (rr <= 0) return 2 * (rw + rh);
  return 2 * (rw + rh - 4 * rr) + 2 * Math.PI * rr;
}

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
.${FITENGINE_NEO_PANEL_CLASS} {
  animation: fitengine-neo-sweep 3.5s ease-in-out infinite;
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
 * Panel con borde neo. `spark`: segmento luminoso que recorre el borde (SVG stroke-dashoffset).
 */
export default function NeoPanel({ style, children, spark = false, ...rest }) {
  const { onLayout: onLayoutOuter, ...restPass } = rest;
  const { t } = useThemeContext();
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  const dashOffset = useRef(new Animated.Value(0)).current;
  const gradIdRef = useRef(`fitengine-spark-grad-${Math.random().toString(36).slice(2, 9)}`);

  const flatStyle = useMemo(() => StyleSheet.flatten(style) || {}, [style]);

  useEffect(() => {
    ensureNeoPanelWebCss();
  }, []);

  const onLayout = useCallback(
    (e) => {
      onLayoutOuter?.(e);
      const { width, height } = e.nativeEvent.layout;
      if (width > 1 && height > 1) {
        setLayout({ w: width, h: height });
      }
    },
    [onLayoutOuter],
  );

  useEffect(() => {
    if (!spark || layout.w < 8 || layout.h < 8) return;
    const inset = 2.5;
    const innerW = Math.max(0, layout.w - 2 * inset);
    const innerH = Math.max(0, layout.h - 2 * inset);
    const rRaw = typeof flatStyle.borderRadius === 'number' ? flatStyle.borderRadius : MOBILE_RADII.lg;
    const r = Math.max(0, Math.min(rRaw, innerW / 2, innerH / 2));
    const P = roundedRectPerimeter(innerW, innerH, r);
    const dashLen = Math.max(16, Math.min(44, P * 0.13));
    const gap = Math.max(4, P - dashLen);
    const cycle = dashLen + gap;

    dashOffset.setValue(0);
    const loop = Animated.loop(
      Animated.timing(dashOffset, {
        toValue: cycle,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spark, layout.w, layout.h, flatStyle.borderRadius, dashOffset]);

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

  const webProps = Platform.OS === 'web' ? { className: FITENGINE_NEO_PANEL_CLASS } : {};

  const sw = 2.5;
  const inset = sw;
  const { w, h } = layout;
  const rRaw = typeof flatStyle.borderRadius === 'number' ? flatStyle.borderRadius : MOBILE_RADII.lg;
  const innerW = Math.max(0, w - 2 * inset);
  const innerH = Math.max(0, h - 2 * inset);
  const r =
    w > 0 && h > 0 ? Math.max(0, Math.min(rRaw, innerW / 2, innerH / 2)) : 0;
  const P = roundedRectPerimeter(innerW, innerH, r);
  const dashLen = Math.max(16, Math.min(44, P * 0.13));
  const gap = Math.max(4, P - dashLen);

  const sparkSvg =
    spark && w > 4 && h > 4 && P > 20 ? (
      <Svg
        pointerEvents="none"
        width={w}
        height={h}
        style={[StyleSheet.absoluteFillObject, { zIndex: 10 }]}
      >
        <Defs>
          <LinearGradient id={gradIdRef.current} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <Stop offset="50%" stopColor={typeof t.brand === 'string' ? t.brand : '#00ffff'} stopOpacity="1" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.8" />
          </LinearGradient>
        </Defs>
        <AnimatedRect
          x={inset}
          y={inset}
          width={innerW}
          height={innerH}
          rx={r}
          ry={r}
          fill="none"
          stroke={`url(#${gradIdRef.current})`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[dashLen, gap]}
          strokeDashoffset={dashOffset}
        />
      </Svg>
    ) : null;

  return (
    <View
      style={[style, edgeStyle, spark && { position: 'relative', overflow: 'hidden' }]}
      onLayout={onLayout}
      {...webProps}
      {...restPass}
    >
      {children}
      {sparkSvg}
    </View>
  );
}

