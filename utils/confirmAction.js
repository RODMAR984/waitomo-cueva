import { Alert, Platform } from 'react-native';

/** Alerta simple visible en Safari iOS (Alert.alert en web a menudo no se muestra). */
export function showAppAlert(title, message) {
  const body = [title, message].filter(Boolean).join('\n\n');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(body);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Confirmación multiplataforma. En web, Alert.alert con botones no ejecuta onPress de forma fiable.
 * @returns {Promise<boolean>}
 */
export function confirmAction({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancelar',
  destructive = false,
}) {
  const body = [title, message].filter(Boolean).join('\n\n');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return Promise.resolve(window.confirm(body));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
