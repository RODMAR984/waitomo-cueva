import { Platform } from 'react-native';

export const MOBILE_SPACING = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const MOBILE_RADII = {
  /** Esquinas muy marcadas (p. ej. previews RM). */
  xxs: 4,
  /** Chips, badges y toques compactos. */
  xs: 6,
  /** Tarjetas / bloques densos (8px; alinea con `MOBILE_SPACING.sm`). */
  compact: 8,
  sm: 10,
  md: 12,
  lg: 16,
  /** Modales y contenedores muy redondeados (20px). */
  xl: 20,
  /** Burbujas de chat tipo “pill” ancho. */
  bubble: 22,
  /** Chips / filas con esquina intermedia (14px). */
  chipMd: 14,
  /** Modales compactos (15px). */
  sheet: 15,
  /** Botón circular estándar (36×36). */
  controlCircle: 18,
  pill: 999,
};

export const MOBILE_SIZES = {
  controlHeight: 48,
  controlHeightLg: 52,
  localeControlHeight: 36,
};

export const MOBILE_TYPE = {
  body: 14,
  bodyStrong: 15,
  title: 22,
  caption: 12,
  /** Meta densa entre micro y caption (p. ej. ~11px). */
  meta: 11,
  /** Etiquetas de fila / UI compacta (p. ej. ~13px). */
  label: 13,
  /** Subcabeceras y títulos de bloque (p. ej. ~16px). */
  subhead: 16,
  /** Titular de card o nombre entre headline y title (p. ej. ~20px). */
  lead: 20,
  /** Subtítulos / secciones secundarias (antes ~18px). */
  headline: 18,
  /** Titulares de marketing o cabeceras compactas (antes ~28px). */
  hero: 28,
  /** Splash / marca grande (antes ~36px). */
  display: 36,
  /** Meta muy pequeña (chips, timestamps); mínimo legible en UI densa. */
  micro: 10,
  /** KPIs numéricos en tableros (antes ~26px). */
  kpi: 26,
};

/**
 * Padding superior estándar para filas con “Volver” bajo status bar / notch (staff, superadmin, Engine room, etc.).
 * Nativo: safe area + aire generoso (xxl+md); web: aire fijo (xxl+sm), sin depender del notch.
 */
export function screenHeaderTopPadding(safeAreaTop) {
  const top =
    typeof safeAreaTop === 'number' && !Number.isNaN(safeAreaTop) ? Math.max(0, safeAreaTop) : 0;
  /** Aire bajo status bar / notch: nativo más generoso (Engine room, staff, superadmin). */
  const belowSafeWeb = MOBILE_SPACING.xxl + MOBILE_SPACING.sm;
  const belowSafeNative = MOBILE_SPACING.xxl + MOBILE_SPACING.md;
  if (Platform.OS === 'web') return belowSafeWeb;
  return top + belowSafeNative;
}
