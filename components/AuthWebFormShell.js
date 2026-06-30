/**
 * Patrón unificado para formularios del flujo auth (web + nativo).
 *
 * En react-native-web, KeyboardAvoidingView y TouchableWithoutFeedback rodeando
 * TextInputs suelen provocar pérdida de foco / cursor que “rebota”.
 * Ver: Login, Registro*, Código invitación, Configura espacio, etc.
 */
import React from 'react';
import {
  Platform,
  View,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

/** En web no usar KAV (comprime el layout en Safari móvil). Mismo patrón en auth y formularios staff. */
export function FormKeyboardAvoidingView({ style, children, ...rest }) {
  if (Platform.OS === 'web') {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={style}
      {...rest}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export const AuthKeyboardAvoidingView = FormKeyboardAvoidingView;

/** En web no envolver: el dismiss al tocar fuera compite con el foco del input. */
export function AuthDismissKeyboardOutside({ children }) {
  if (Platform.OS === 'web') return children;
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {children}
    </TouchableWithoutFeedback>
  );
}

export const authScrollKeyboardDismissMode = Platform.OS === 'web' ? 'none' : 'on-drag';

export function authScrollContentJustify() {
  return Platform.OS === 'web' ? 'flex-start' : 'center';
}
