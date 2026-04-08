import React, { useMemo } from 'react';
import Svg, { Defs, LinearGradient, Polygon, Stop, Path, Circle } from 'react-native-svg';

type Props = {
  // Tamaño del componente en pixeles (square). El SVG usa viewBox 100x100.
  size: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function FitEngineLogo({ size }: Props) {
  const viewBox = '0 0 100 100';

  // Triángulo tipo "play" (apunta a la derecha)
  const vA = { x: 18, y: 20 }; // arriba-izq
  const vB = { x: 18, y: 80 }; // abajo-izq
  const vC = { x: 80, y: 50 }; // punta derecha

  // Rayos de partículas hacia los costados (izq/der)
  const rays = useMemo(
    () => [
      { from: vA, to: { x: 2, y: 32 } },
      { from: vA, to: { x: 98, y: 26 } },
      { from: vB, to: { x: 2, y: 68 } },
      { from: vB, to: { x: 98, y: 74 } },
      { from: vC, to: { x: 2, y: 50 } },
      { from: vC, to: { x: 98, y: 50 } },
    ],
    [],
  );

  // Puntos sobre cada rayo para simular "líneas conectadas por puntos"
  const dotStops = [0.18, 0.34, 0.5, 0.66, 0.82];

  const dots = useMemo(() => {
    const out: Array<{ cx: number; cy: number; key: string }> = [];
    rays.forEach((ray, i) => {
      dotStops.forEach((t, j) => {
        out.push({
          cx: lerp(ray.from.x, ray.to.x, t),
          cy: lerp(ray.from.y, ray.to.y, t),
          key: `d-${i}-${j}`,
        });
      });
    });
    return out;
  }, [rays]);

  const trianglePoints = `${vA.x},${vA.y} ${vB.x},${vB.y} ${vC.x},${vC.y}`;
  const innerPoints = `22,26 22,74 76,50`;

  return (
    <Svg width={size} height={size} viewBox={viewBox}>
      <Defs>
        {/* Metal gris 3D */}
        <LinearGradient id="metalFill" x1="18" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F5F7FA" stopOpacity="1" />
          <Stop offset="0.28" stopColor="#C9CED5" stopOpacity="1" />
          <Stop offset="0.62" stopColor="#8F98A3" stopOpacity="1" />
          <Stop offset="1" stopColor="#F5F7FA" stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="metalEdge" x1="18" y1="20" x2="80" y2="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <Stop offset="0.5" stopColor="#B7C0C9" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#6F7883" stopOpacity="0.9" />
        </LinearGradient>

        {/* Partículas cyan */}
        <LinearGradient id="cyanGlow" x1="20" y1="20" x2="98" y2="80" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#00E5FF" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#86C4C7" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>

      {/* Rays / partículas */}
      {rays.map((ray, i) => (
        <Path
          // @ts-expect-error - react-native-svg types sometimes lag behind
          key={`ray-${i}`}
          d={`M ${ray.from.x} ${ray.from.y} L ${ray.to.x} ${ray.to.y}`}
          stroke="url(#cyanGlow)"
          strokeWidth={1.4}
          strokeOpacity={0.9}
          strokeLinecap="round"
          fill="none"
        />
      ))}

      {/* Puntos sobre los rayos */}
      {dots.map((d) => (
        <Circle
          key={d.key}
          cx={d.cx}
          cy={d.cy}
          r={1.35}
          fill="#00E5FF"
          opacity={0.95}
        />
      ))}

      {/* Sombra/relieve leve para profundidad (sin fondo propio) */}
      <Polygon points={trianglePoints} fill="url(#metalFill)" opacity={0.95} />
      <Polygon points={innerPoints} fill="#FFFFFF" opacity={0.22} />
      <Polygon
        points={trianglePoints}
        fill="transparent"
        stroke="url(#metalEdge)"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />

      {/* Brillos extra cerca de la punta */}
      <Path
        d="M76 50 L62 42 L62 58 Z"
        fill="#FFFFFF"
        opacity={0.28}
      />
    </Svg>
  );
}

