// Campo contraseña con opción mostrar/ocultar (ícono ojo)
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function PasswordInput({
  value,
  onChangeText,
  placeholder = 'Contraseña',
  placeholderTextColor = colors.dark.placeholder,
  style,
  containerStyle,
  ...rest
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        secureTextEntry={!visible}
        style={[styles.inputBase, style]}
        {...rest}
      />
      <TouchableOpacity
        style={styles.eye}
        onPress={() => setVisible((v) => !v)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color={colors.dark.placeholder}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', marginBottom: 0 },
  inputBase: { paddingRight: 44 },
  eye: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
