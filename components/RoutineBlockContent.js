import React from 'react';
import { Platform, Text } from 'react-native';
import { splitTextWithRmTokens, formatRmWeightKg } from '../utils/rmPattern';
import { normalizeRoutineBlockText } from '../utils/normalizeRoutineBlockText';
import { MOBILE_TYPE } from '../theme/mobileSpec';

const CONTENT_BASE = {
  fontSize: MOBILE_TYPE.bodyStrong,
  lineHeight: 20,
  ...(Platform.OS === 'android' ? { textAlignVertical: 'center', includeFontPadding: false } : {}),
};

/**
 * Renderiza el contenido de un bloque igual que el preview del admin:
 * un único Text padre con hijos inline (sin pre-wrap ni líneas sueltas).
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
  const raw = normalizeRoutineBlockText(text);
  if (!raw.trim()) return null;

  const parts = splitTextWithRmTokens(raw);
  const rootStyle = [CONTENT_BASE, textStyle];

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
            style={[CONTENT_BASE, rmStyle]}
            onPress={onRmPress ? () => onRmPress(seg.exercise, pctLabel) : undefined}
          >
            {tokenShown}
            {!displayWeight && rmStored == null && rmHintStyle && tStr ? (
              <Text style={[CONTENT_BASE, rmHintStyle]}> {tStr('trabajo_rm_tap_completar')}</Text>
            ) : null}
          </Text>
        );
      })}
    </Text>
  );
}
