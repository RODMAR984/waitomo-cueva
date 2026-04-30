import { Platform, useWindowDimensions } from 'react-native';

/** Misma regla que StaffWebDesktopShell: web ancho con rail staff. */
const STAFF_WEB_DESKTOP_MIN = 1100;

/**
 * En web escritorio staff ocultamos el botón «volver» en pantalla y usamos el historial del navegador.
 */
export default function useStaffWebHideInlineBack() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= STAFF_WEB_DESKTOP_MIN;
}
