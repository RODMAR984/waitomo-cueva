// Triángulo como fondo. Registro Owner: triangulo.png o triangulo.svg. Otros: logo-fitengine-triangulo.svg.
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { logoColors } from '../theme/colors';

let TriangleLogo = null;
try {
  TriangleLogo = require('../assets/logo-fitengine-triangulo.svg').default;
} catch {
  TriangleLogo = null;
}

let TriangleRegistroPng = null;
let TriangleRegistroSvgLegacy = null;
let TriangleRegistroSvgCurrent = null;
try {
  TriangleRegistroPng = require('../assets/triangulo AB.png');
} catch {}
try {
  TriangleRegistroPng = TriangleRegistroPng || require('../assets/triangulo.png');
} catch {}
try {
  TriangleRegistroSvgLegacy = require('../assets/triangulo.svg').default;
} catch {}
try {
  TriangleRegistroSvgCurrent = require('../assets/triangulonofound.svg').default;
} catch {}

const SIZE = 520;
const OPACITY_DARK = 0.14;
const OPACITY_LIGHT = 0.08;
const DEFAULT_ASSET_W = 700;
const DEFAULT_ASSET_H = 598;

// Relación según asset
// - triangulo.svg (legacy) => viewBox 1403.09 x 354.16
// - triangulonofound.svg (current) => viewBox 841.9 x 595.3
const REG_LEGACY_W = 1403.09;
const REG_LEGACY_H = 354.16;
const REG_CURRENT_W = 841.9;
const REG_CURRENT_H = 595.3;

export default function LogoTriangleBackground({
  isDark,
  sizeScale = 1,
  opacityOverride,
  variant = 'default',
  blendMode = 'screen',
}) {
  const opacity = opacityOverride != null ? opacityOverride : (isDark ? OPACITY_DARK : OPACITY_LIGHT);
  const fill = isDark ? logoColors.cian : '#050a0d';
  const w = SIZE * sizeScale;
  const registroAspect = TriangleRegistroSvgCurrent ? { w: REG_CURRENT_W, h: REG_CURRENT_H } : { w: REG_LEGACY_W, h: REG_LEGACY_H };
  const h =
    variant === 'registro'
      ? (w * registroAspect.h) / registroAspect.w
      : (w * DEFAULT_ASSET_H) / DEFAULT_ASSET_W;

  const isRegistro = variant === 'registro';
  const registroPng = isRegistro && TriangleRegistroPng;
  const registroSvg = isRegistro && !TriangleRegistroPng && (TriangleRegistroSvgCurrent || TriangleRegistroSvgLegacy);
  const defaultSvg = !isRegistro && TriangleLogo;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
      <View style={[styles.centered, { width: '100%', height: '100%' }]}>
        <View style={{ opacity, mixBlendMode: blendMode, alignSelf: 'center', justifyContent: 'center' }}>
          {registroPng ? (
            <Image
              source={TriangleRegistroPng}
              style={{ width: w, height: h }}
              resizeMode="contain"
            />
          ) : registroSvg ? (
            TriangleRegistroSvgCurrent ? (
              <TriangleRegistroSvgCurrent width={w} height={h} />
            ) : (
              <TriangleRegistroSvgLegacy width={w} height={h} />
            )
          ) : defaultSvg ? (
            <TriangleLogo width={w} height={h} />
          ) : (
            <Svg width={w} height={w * 0.85} viewBox="0 0 100 100">
              <Path d="M50 8 L92 88 L8 88 Z" fill={fill} />
            </Svg>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
