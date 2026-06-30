import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { estimateOneRmEpley, formatRmWeightKg } from '../utils/rmPattern';

const WEB_INPUT =
  Platform.OS === 'web' ? { boxSizing: 'border-box', maxWidth: '100%' } : null;

/**
 * Calculadora 1RM (Epley): peso + reps → estimado, opcional guardar o aplicar al modal.
 */
export default function RmCalculatorPanel({
  tStr,
  styles,
  placeholderColor,
  initialExercise = '',
  onSaveOneRm,
  onApplyOneRm,
  compact = false,
}) {
  const [exercise, setExercise] = useState(initialExercise);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('5');

  useEffect(() => {
    if (initialExercise) setExercise(initialExercise);
  }, [initialExercise]);

  const estimatedKg = useMemo(() => {
    const w = parseFloat(String(weight).replace(',', '.'));
    const r = parseInt(String(reps).replace(',', '.'), 10);
    return estimateOneRmEpley(w, r);
  }, [weight, reps]);

  const formattedEstimate = estimatedKg != null ? formatRmWeightKg(estimatedKg) : null;

  const handleSave = () => {
    if (estimatedKg == null) {
      Alert.alert(tStr('trabajo_dia_rm_invalid_title'), tStr('trabajo_rm_calc_invalid'));
      return;
    }
    const name = exercise.trim();
    if (!name) {
      Alert.alert(tStr('trabajo_dia_rm_invalid_title'), tStr('trabajo_rm_calc_need_exercise'));
      return;
    }
    onSaveOneRm?.(name, estimatedKg);
  };

  const handleApply = () => {
    if (estimatedKg == null) {
      Alert.alert(tStr('trabajo_dia_rm_invalid_title'), tStr('trabajo_rm_calc_invalid'));
      return;
    }
    onApplyOneRm?.(estimatedKg);
  };

  const hasDualActions = Boolean(onApplyOneRm && onSaveOneRm);

  return (
    <View style={[styles.rmCalcBox, compact && styles.rmCalcBoxCompact]}>
      {!compact ? <Text style={styles.rmCalcTitle}>{tStr('trabajo_rm_calc_title')}</Text> : null}
      <Text style={styles.rmCalcHint}>{tStr('trabajo_rm_calc_hint')}</Text>

      <View style={styles.rmCalcField}>
        <Text style={styles.rmCalcLabel}>{tStr('trabajo_rm_calc_exercise_label')}</Text>
        <TextInput
          style={[styles.rmCalcInput, WEB_INPUT]}
          value={exercise}
          onChangeText={setExercise}
          placeholder={tStr('trabajo_rm_calc_exercise_ph')}
          placeholderTextColor={placeholderColor}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.rmCalcRow}>
        <View style={[styles.rmCalcField, styles.rmCalcFieldGrow]}>
          <Text style={styles.rmCalcLabel}>{tStr('trabajo_rm_calc_weight_label')}</Text>
          <TextInput
            style={[styles.rmCalcInput, WEB_INPUT]}
            value={weight}
            onChangeText={setWeight}
            placeholder="80"
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={[styles.rmCalcField, styles.rmCalcFieldReps]}>
          <Text style={styles.rmCalcLabel}>{tStr('trabajo_rm_calc_reps_label')}</Text>
          <TextInput
            style={[styles.rmCalcInput, styles.rmCalcInputReps, WEB_INPUT]}
            value={reps}
            onChangeText={setReps}
            placeholder="5"
            placeholderTextColor={placeholderColor}
            keyboardType="number-pad"
            maxLength={2}
            textAlign="center"
          />
        </View>
      </View>

      {formattedEstimate != null ? (
        <Text style={styles.rmCalcResult}>
          {tStr('trabajo_rm_calc_result').replace('{{kg}}', formattedEstimate)}
        </Text>
      ) : null}

      <View style={[styles.rmCalcActions, !hasDualActions && styles.rmCalcActionsSingle]}>
        {onApplyOneRm ? (
          <TouchableOpacity
            style={[
              styles.rmCalcBtn,
              styles.rmCalcBtnSecondary,
              hasDualActions ? styles.rmCalcBtnHalf : styles.rmCalcBtnFull,
            ]}
            onPress={handleApply}
            activeOpacity={0.88}
            disabled={formattedEstimate == null}
          >
            <Text style={styles.rmCalcBtnTextSecondary}>{tStr('trabajo_rm_calc_use')}</Text>
          </TouchableOpacity>
        ) : null}
        {onSaveOneRm ? (
          <TouchableOpacity
            style={[
              styles.rmCalcBtn,
              styles.rmCalcBtnPrimary,
              hasDualActions ? styles.rmCalcBtnHalf : styles.rmCalcBtnFull,
            ]}
            onPress={handleSave}
            activeOpacity={0.88}
            disabled={formattedEstimate == null}
          >
            <Text style={styles.rmCalcBtnTextPrimary}>{tStr('trabajo_rm_calc_save')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
