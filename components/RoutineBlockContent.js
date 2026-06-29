import React from 'react';
import { Platform, Text } from 'react-native';
import { splitTextWithRmTokens, formatRmWeightKg } from '../utils/rmPattern';

/**
 * Renderiza el contenido de un bloque respetando saltos de línea, espacios y tabulación
 * (misma idea que el preview del admin: un Text padre con hijos inline).
 */
export default function RoutineBlockContent({
  text,
  getRM,
  calculateWeight,
  onRmPress,
  textStyle,
  rmStyle,
  rmHintStyle,
  tStr,
}) {
  const raw = text == null ? '' : Array.isArray(text) ? text.join('\n') : String(text);
  if (!raw.trim()) return null;

  const parts = splitTextWithRmTokens(raw);
  const rootStyle = [
    textStyle,
    Platform.OS === 'web' ? { whiteSpace: 'pre-wrap' } : null,
  ];

  return (
    <Text style={rootStyle}>
      {parts.map((seg, i) => {
        if (seg.type === 'text') {
          return <Text key={`t_${i}`}>{seg.value}</Text>;
        }
        const pctNum = seg.pctNumber;
        const rmStored = typeof getRM === 'function' ? getRM(seg.exercise) : null;
        const hasNumericPct = !Number.isNaN(pctNum);
        const weight =
          hasNumericPct && rmStored != null && typeof calculateWeight === 'function'
            ? calculateWeight(pctNum, rmStored, seg.reps)
            : null;
        const displayWeight =
          weight != null && !Number.isNaN(weight) ? `${formatRmWeightKg(weight)} kg` : null;
        const pctLabel = hasNumericPct ? `${pctNum}%` : `${seg.pctRaw}%`;
        const tokenShown = displayWeight || seg.full;

        return (
          <Text
            key={`rm_${i}`}
            style={rmStyle}
            onPress={onRmPress ? () => onRmPress(seg.exercise, pctLabel) : undefined}
          >
            {tokenShown}
            {!displayWeight && rmStored == null && rmHintStyle && tStr ? (
              <Text style={rmHintStyle}> {tStr('trabajo_rm_tap_completar')}</Text>
            ) : null}
          </Text>
        );
      })}
    </Text>
  );
}
