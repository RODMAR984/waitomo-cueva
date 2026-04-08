// Logo completo en PNG (principal) con fallback a composición triangulo + texto.
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const RATIO_LEGACY = 1403.09 / 354.16; // triangulo.svg (viewBox 1403.09 x 354.16)
const RATIO_CURRENT = 841.9 / 595.3; // triangulonofound.svg (viewBox 841.9 x 595.3)

// PNG principal del logo completo
let LogoCompletoPng = null;
try {
  LogoCompletoPng = require('../assets/LOGO COMPLETO AB .png');
} catch {}

// TRIÁNGULO (fallback)
let TrianguloPng = null;
let TrianguloSvgLegacy = null;
let TrianguloSvgCurrent = null;
try {
  TrianguloPng = require('../assets/triangulo AB.png');
} catch {}
try {
  TrianguloPng = TrianguloPng || require('../assets/triangulo.png');
} catch {}
try {
  TrianguloSvgLegacy = require('../assets/triangulo.svg').default;
} catch {}
try {
  TrianguloSvgCurrent = require('../assets/triangulonofound.svg').default;
} catch {}

// TEXTO (fallback)
let TextoPng = null;
let TextoSvgLegacy = null;
let TextoSvgCurrent = null;
try {
  TextoPng = require('../assets/texto AB.png');
} catch {}
try {
  TextoPng = TextoPng || require('../assets/texto.png');
} catch {}

const getRatio = (asset, fallback = 2.4) => {
  if (!asset) return fallback;
  try {
    const meta = Image.resolveAssetSource(asset);
    if (meta?.width && meta?.height) return meta.width / meta.height;
  } catch {}
  return fallback;
};

// Calculado una sola vez (mejor rendimiento en render)
const FULL_RATIO = getRatio(LogoCompletoPng, 2.4);
const TRI_RATIO = getRatio(TrianguloPng, TrianguloSvgCurrent ? RATIO_CURRENT : RATIO_LEGACY);
const TEXT_RATIO = getRatio(TextoPng, TrianguloSvgCurrent ? RATIO_CURRENT : RATIO_LEGACY);
try {
  TextoSvgLegacy = require('../assets/texto.svg').default;
} catch {}
try {
  TextoSvgCurrent = require('../assets/textonofound.svg').default;
} catch {}

export default function LogoCompleto({ height = 80, style }) {
  if (LogoCompletoPng) {
    return (
      <View style={[styles.row, style, { height }]}>
        <Image
          source={LogoCompletoPng}
          style={[styles.full, { height, width: height * FULL_RATIO }]}
          resizeMode="contain"
        />
      </View>
    );
  }

  const TriNode = TrianguloPng ? (
    <Image source={TrianguloPng} style={[styles.triangulo, { height, width: height * TRI_RATIO }]} resizeMode="contain" />
  ) : TrianguloSvgCurrent ? (
    <TrianguloSvgCurrent width={height * RATIO_CURRENT} height={height} />
  ) : TrianguloSvgLegacy ? (
    <TrianguloSvgLegacy width={height * RATIO_LEGACY} height={height} />
  ) : null;

  const TextNode = TextoPng ? (
    <Image source={TextoPng} style={[styles.texto, { height, width: height * TEXT_RATIO }]} resizeMode="contain" />
  ) : TextoSvgCurrent ? (
    <TextoSvgCurrent width={height * RATIO_CURRENT} height={height} />
  ) : TextoSvgLegacy ? (
    <TextoSvgLegacy width={height * RATIO_LEGACY} height={height} />
  ) : null;

  if (!TriNode || !TextNode) return null;

  return (
    <View style={[styles.row, style, { height }]}>
      {TriNode}
      {TextNode}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  triangulo: {
    width: undefined,
    marginRight: 0,
  },
  full: {
    width: undefined,
  },
  texto: {
    width: undefined,
    marginLeft: 0,
  },
});
