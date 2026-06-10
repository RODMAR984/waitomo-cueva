import { Alert, Platform } from 'react-native';

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
