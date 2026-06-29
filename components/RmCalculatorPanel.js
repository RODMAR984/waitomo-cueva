import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { estimateOneRmEpley, formatRmWeightKg } from '../utils/rmPattern';

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

  return (
    <View style={[styles.rmCalcBox, compact && styles.rmCalcBoxCompact]}>
      {!compact ? <Text style={styles.rmCalcTitle}>{tStr('trabajo_rm_calc_title')}</Text> : null}
      <Text style={styles.rmCalcHint}>{tStr('trabajo_rm_calc_hint')}</Text>

      <TextInput
        style={styles.rmCalcInput}
        value={exercise}
        onChangeText={setExercise}
        placeholder={tStr('trabajo_rm_calc_exercise_ph')}
        placeholderTextColor={placeholderColor}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.rmCalcRow}>
        <TextInput
          style={[styles.rmCalcInput, styles.rmCalcInputHalf]}
          value={weight}
          onChangeText={setWeight}
          placeholder={tStr('trabajo_rm_calc_weight_ph')}
          placeholderTextColor={placeholderColor}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={[styles.rmCalcInput, styles.rmCalcInputHalf]}
          value={reps}
          onChangeText={setReps}
          placeholder={tStr('trabajo_rm_calc_reps_ph')}
          placeholderTextColor={placeholderColor}
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>

      {formattedEstimate != null ? (
        <Text style={styles.rmCalcResult}>
          {tStr('trabajo_rm_calc_result').replace('{{kg}}', formattedEstimate)}
        </Text>
      ) : null}

      <View style={styles.rmCalcActions}>
        {onApplyOneRm ? (
          <TouchableOpacity
            style={[styles.rmCalcBtn, styles.rmCalcBtnSecondary]}
            onPress={handleApply}
            activeOpacity={0.88}
            disabled={formattedEstimate == null}
          >
            <Text style={styles.rmCalcBtnTextSecondary}>{tStr('trabajo_rm_calc_use')}</Text>
          </TouchableOpacity>
        ) : null}
        {onSaveOneRm ? (
          <TouchableOpacity
            style={[styles.rmCalcBtn, styles.rmCalcBtnPrimary]}
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
