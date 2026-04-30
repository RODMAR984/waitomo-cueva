// Logo completo en PNG. Ancho ~2,45× alto: el tamaño se calcula con el ancho REAL del contenedor
// (onLayout). Los padres con alignItems:'center' deben dar width:'100%' al bloque del logo.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';

const logoCompletoSrc = require('../assets/logo-completo-ab.png');

const getRatio = (asset, fallback) => {
  try {
    const meta = Image.resolveAssetSource(asset);
    if (meta?.width && meta?.height) return meta.width / meta.height;
  } catch {}
  return fallback;
};

const FULL_RATIO = getRatio(logoCompletoSrc, 1604 / 656);

export default function LogoCompleto({ height = 80, style, horizontalGutter = 12 }) {
  const { width: winW } = useWindowDimensions();
  const [boxW, setBoxW] = useState(0);

  const onLayout = useCallback((e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 8) setBoxW(prev => (prev === w ? prev : w));
  }, []);

  const { width: imgW, height: imgH } = useMemo(() => {
    const avail = Math.max(80, (boxW > 8 ? boxW : winW) - horizontalGutter);
    const idealW = height * FULL_RATIO;
    if (idealW <= avail) return { width: idealW, height };
    return { width: avail, height: avail / FULL_RATIO };
  }, [height, boxW, winW, horizontalGutter]);

  return (
    <View onLayout={onLayout} style={[styles.outer, style, { minHeight: imgH }]}>
      <Image source={logoCompletoSrc} style={{ width: imgW, height: imgH }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
