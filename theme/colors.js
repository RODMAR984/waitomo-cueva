// theme/colors.js — punto único de verdad Waitomo
// - Sin literales en JSX: usá estos tokens en todas las screens
// - Botones unificados: outline (fondo translúcido + borde y texto en color), no bloque sólido

import { isWaitomoOrg } from '../config/waitomo';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Mezcla dos hex #RRGGBB (t=0 → a, t=1 → b) */
const mixHex = (hexA, hexB, t) => {
  const parse = (h) => {
    const c = String(h || '').replace('#', '');
    const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
    if (full.length !== 6) return [255, 255, 255];
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(hexA);
  const [r2, g2, b2] = parse(hexB);
  const ch = (a, b) => Math.round(a + (b - a) * t);
  const r = ch(r1, r2);
  const g = ch(g1, g2);
  const b = ch(b1, b2);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const HEX6_OPT = /^#?([0-9A-Fa-f]{6})$/;
const normalizeTextColor = (raw) => {
  const s = String(raw || '').trim();
  const m = s.match(HEX6_OPT);
  if (!m) return null;
  return `#${m[1]}`;
};

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

const hexToRgb = (hex) => {
  const normalized = normalizeTextColor(hex);
  if (!normalized) return null;
  const clean = normalized.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
};

const relativeLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLinear = (c) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Ajusta color custom para mantener contraste por modo.
 * Mismo hex configurado por el gym puede verse diferente en dark/light para legibilidad.
 */
const adaptTextColorForMode = (hex, isDark, kind = 'primary') => {
  const normalized = normalizeTextColor(hex);
  if (!normalized) return null;
  const lum = relativeLuminance(normalized);

  if (isDark) {
    if (kind === 'primary' && lum < 0.5) return mixHex(normalized, '#ffffff', clamp01((0.5 - lum) * 1.7));
    if (kind === 'secondary' && lum < 0.42) return mixHex(normalized, '#e2e8f0', clamp01((0.42 - lum) * 1.35));
    return normalized;
  }

  if (kind === 'primary' && lum > 0.45) return mixHex(normalized, '#0f172a', clamp01((lum - 0.45) * 1.7));
  if (kind === 'secondary' && lum > 0.56) return mixHex(normalized, '#334155', clamp01((lum - 0.56) * 1.25));
  return normalized;
};

/** Color de fuente opcional: columna legacy o `features.text_color` (sin migración extra). */
export function resolveOrgTextColor(org) {
  if (!org) return null;
  const fromFeatures =
    org.features && typeof org.features === 'object' && org.features !== null
      ? org.features.text_color
      : null;
  return normalizeTextColor(org.text_color ?? fromFeatures);
}

/** Secundario (subtítulos, ayudas): `features.text_secondary_color`. */
export function resolveOrgSecondaryTextColor(org) {
  if (!org) return null;
  const fromFeatures =
    org.features && typeof org.features === 'object' && org.features !== null
      ? org.features.text_secondary_color
      : null;
  return normalizeTextColor(org.text_secondary_color ?? fromFeatures);
}

/** Opcional: tinte de cajas/paneles (`features.ui_surface_color`), independiente del acento. */
export function resolveOrgUiSurfaceColor(org) {
  if (!org?.features || typeof org.features !== 'object') return null;
  return normalizeTextColor(org.features.ui_surface_color);
}

/** Opcional: color de bordes UI (`features.ui_border_color`). */
export function resolveOrgUiBorderColor(org) {
  if (!org?.features || typeof org.features !== 'object') return null;
  return normalizeTextColor(org.features.ui_border_color);
}

/** Opcional: tinte del overlay de pantalla (`features.ui_overlay_color`) — velo sobre fondo/imagen, distinto de cajas. */
export function resolveOrgUiOverlayColor(org) {
  if (!org?.features || typeof org.features !== 'object') return null;
  return normalizeTextColor(org.features.ui_overlay_color);
}

/**
 * Aplica overrides de superficie/borde/overlay sin mezclar con acento ni tipografía.
 */
function applySurfaceBorderUiOverride(base, isDark, org) {
  const s = resolveOrgUiSurfaceColor(org);
  const b = resolveOrgUiBorderColor(org);
  const o = resolveOrgUiOverlayColor(org);
  if (!s && !b && !o) return base;
  const next = { ...base };
  if (s) {
    if (isDark) {
      next.boxBg = hexToRgba(s, 0.36);
      next.overlayBg = hexToRgba(s, 0.26);
      next.inputBg = hexToRgba(s, 0.2);
      next.inactiveTabBg = hexToRgba(s, 0.14);
      next.segmentInactiveBg = hexToRgba(s, 0.12);
    } else {
      next.boxBg = mixHex('#ffffff', s, 0.26);
      next.overlayBg = mixHex('#f1f5f9', s, 0.38);
      next.inputBg = mixHex('#ffffff', s, 0.14);
      next.inactiveTabBg = mixHex('#f8fafc', s, 0.45);
      next.segmentInactiveBg = mixHex('#f1f5f9', s, 0.42);
    }
  }
  if (b) {
    next.overlayBorder = isDark ? hexToRgba(b, 0.58) : hexToRgba(b, 0.4);
    next.border = b;
    next.borderStrong = b;
  }
  if (o) {
    // Velo sobre el fondo (BackgroundWrapper); alfa distinto claro/oscuro para legibilidad.
    next.screenOverlay = isDark ? hexToRgba(o, 0.44) : hexToRgba(o, 0.14);
  }
  return next;
}

// Cian y gris del logo FitEngine (logo-navbar) — nodos cian y letras metálicas
export const logoColors = {
  cian: '#90ABB5',       // nodos cian del logo → primary/glow
  metallicGrey: '#9A9D9F', // gris letras → textos secundarios
};

// Colores extraídos del SVG del logo FitEngine (logo-fitengine.svg) — SOLO para pantallas
// Login / Welcome / Splash (identidad FitEngine). NO usar cyan Waitomo ni overlay Waitomo.
export const fitengineLogoColors = {
  primary: '#86C4C7',        // teal del logo (path fill en SVG)
  primaryLight: '#A2C6CA',   // teal claro
  metallic: '#9A9D9F',      // gris metálico texto secundario
  background: '#050a0d',     // fondo oscuro
  text: '#f4f8f9',
  subText: '#9A9D9F',
  buttonBg: 'rgba(134, 196, 199, 0.18)',
  buttonBorder: '#86C4C7',
  buttonText: '#86C4C7',
  panelBg: 'rgba(134, 196, 199, 0.12)',
  panelBorder: 'rgba(134, 196, 199, 0.45)',
  inputBg: 'rgba(134, 196, 199, 0.15)',
  inputBorder: 'rgba(134, 196, 199, 0.5)',
  placeholder: '#7a8a8e',
};

// Tokens fijos de identidad FitEngine (pantallas globales: splash/welcome/login).
// No dependen de organization/accent/preset.
export const fitengineUiTokens = {
  bg: fitengineLogoColors.background,
  text: fitengineLogoColors.text,
  subText: fitengineLogoColors.subText,
  overlayBorder: fitengineLogoColors.panelBorder,
  inputBg: fitengineLogoColors.inputBg,
  logoCian: fitengineLogoColors.primary,
};

export const colors = {
  transparent: 'transparent',

  brand: {
    primary: '#00ffff',   // cian principal más brillante
    secondary: '#00eaea', // acento
    lightAccent: '#00dddd',
    darkAccent: '#008888',
    logoCian: logoColors.cian,
    danger: '#ff5a5a',
  },

  dark: {
    background: '#050a0d',
    cardBackground: 'rgba(0,0,0,0.25)',
    border: '#00fafa',
    textPrimary: '#f4ffff',
    textSecondary: '#cfffff',
    placeholder: '#9ef',
    emptyMessage: '#aff',
    buttonText: '#003333',
  },

  // Modo claro: como ref. imagen — card cyan suave, fondo blanco-azulado, títulos azul oscuro
  light: {
    background: '#e8f4f8',
    cardBackground: '#d4eef4',
    border: '#8fc9d4',
    textPrimary: '#1a3a4a',
    textSecondary: '#4a5860',
    placeholder: '#6b7280',
    emptyMessage: '#5a6068',
    buttonText: '#003333',
  },

  // Botones: oscuro = outline cyan. Claro = relleno cyan suave (ref. imagen) + texto blanco
  buttons: {
    primary: {
      backgroundColor: hexToRgba('#00ffff', 0.14),
      borderColor: '#00ffff',
      borderWidth: 1,
    },
    primaryText: { color: '#f4ffff', fontWeight: 'bold' },
    primaryLight: {
      backgroundColor: '#5ec4d4',
      borderColor: '#4ab4c4',
      borderWidth: 1,
    },
    primaryTextLight: { color: '#ffffff', fontWeight: 'bold' },
    danger: {
      backgroundColor: hexToRgba('#ff5a5a', 0.14),
      borderColor: '#ff5a5a',
      borderWidth: 1,
    },
    dangerText: { color: '#f4ffff', fontWeight: 'bold' },
  },
};

// === TOKENS UNIFICADOS WAITOMO ===
// boxBg = fondo brumoso (translúcido, como el recuadro principal de PerfilUsuarioScreen)
export const waitomo = {
  alpha: {
    overlayBg: 0.2,      // brillo de halo / brumoso
    overlayBorder: 0.75, // borde bioluminiscente
    inputBg: 0.22,       // fondo translúcido más luminoso
    boxBg: 0.2,          // cajas/paneles: mismo tono brumoso (cyan translúcido)
    divider: 0.14,
    selected: 0.25,
    faint: 0.1,
  },

  get boxBg() {
    return hexToRgba(colors.brand.primary, this.alpha.boxBg);
  },

  get overlayBg() {
    return hexToRgba(colors.brand.primary, this.alpha.overlayBg);
  },
  get overlayBorder() {
    return hexToRgba(colors.brand.primary, this.alpha.overlayBorder);
  },
  get inputBg() {
    return hexToRgba(colors.brand.primary, this.alpha.inputBg);
  },
  get divider() {
    return hexToRgba(colors.brand.primary, this.alpha.divider);
  },
  get selected() {
    return hexToRgba(colors.brand.primary, this.alpha.selected);
  },
  get faint() {
    return hexToRgba(colors.dark.textPrimary, this.alpha.faint);
  },
};

// Waitomo: identidad fija — no pasa por branding dinámico (#20b)
// isWaitomoOrg viene de config/waitomo.js (UUID), no por nombre de org.

// Tokens base por modo (Waitomo fijo — #20b)
function getThemeTokensBase(mode) {
  const isDark = mode !== 'light';
  if (isDark) {
    return {
      bg: colors.dark.background,
      text: colors.dark.textPrimary,
      subText: colors.dark.textSecondary,
      placeholder: colors.dark.placeholder,
      place: colors.dark.placeholder,
      empty: colors.dark.emptyMessage,
      border: colors.dark.border,
      brand: colors.brand.primary,
      overlayBg: hexToRgba(colors.brand.primary, 0.22),
      overlayBorder: hexToRgba(colors.brand.primary, 0.52),
      boxBg: hexToRgba(colors.brand.primary, 0.24),
      inputBg: hexToRgba(colors.brand.primary, 0.26),
      faint: hexToRgba(colors.dark.textPrimary, 0.06),
      faintStrong: hexToRgba(colors.dark.textPrimary, 0.12),
      primaryText: colors.buttons.primaryText.color,
      onBrand: colors.dark.buttonText,
      brand2: colors.brand.secondary,
      danger: colors.brand.danger,
      buttonPrimary: colors.buttons.primary,
      buttonPrimaryText: colors.buttons.primaryText,
      buttonDanger: colors.buttons.danger,
      buttonDangerText: colors.buttons.dangerText,
      activeTabBg: hexToRgba(colors.brand.primary, 0.28),
      inactiveTabBg: hexToRgba(colors.brand.primary, 0.24),
      borderStrong: colors.brand.primary,
      screenOverlay: 'rgba(0,0,0,0.24)',
      segmentInactiveBg: hexToRgba(colors.dark.textPrimary, 0.12),
      segmentInactiveText: colors.dark.textPrimary,
      brandText: colors.brand.primary,
      brandTextShadow: 'rgba(0,255,252,0.5)',
      metallicGrey: logoColors.metallicGrey,
      logoCian: logoColors.cian,
      buttonGlow: {
        shadowColor: logoColors.cian,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 4,
      },
    };
  }
  const cyan = colors.brand.primary;
  const lightCyanCard = '#d4eef4';
  const lightCyanRow = '#d8f0f5';
  const lightCyanBg = '#e8f4f8';
  const cyanBorder = '#00a8a8';
  return {
    bg: lightCyanBg,
    text: colors.light.textPrimary,
    subText: colors.light.textSecondary,
    placeholder: colors.light.placeholder,
    place: colors.light.placeholder,
    empty: colors.light.emptyMessage,
    border: cyanBorder,
    brand: cyan,
    overlayBorder: cyanBorder,
    overlayBg: lightCyanRow,
    boxBg: lightCyanCard,
    inputBg: 'rgba(255,255,255,0.9)',
    faint: 'rgba(0,0,0,0.04)',
    faintStrong: 'rgba(255,255,255,0.7)',
    primaryText: colors.buttons.primaryTextLight.color,
    onBrand: colors.light.buttonText,
    brand2: colors.brand.secondary,
    danger: colors.brand.danger,
    buttonPrimary: colors.buttons.primaryLight,
    buttonPrimaryText: colors.buttons.primaryTextLight,
    buttonDanger: colors.buttons.danger,
    buttonDangerText: colors.buttons.dangerText,
    activeTabBg: hexToRgba(cyan, 0.35),
    inactiveTabBg: 'rgba(255,255,255,0.85)',
    borderStrong: '#00b8b8',
    screenOverlay: hexToRgba(cyan, 0.18),
    segmentInactiveBg: 'rgba(255,255,255,0.98)',
    segmentInactiveText: colors.light.textPrimary,
    brandText: '#008b8b',
    brandTextShadow: 'rgba(0,0,0,0.12)',
    metallicGrey: logoColors.metallicGrey,
    logoCian: logoColors.cian,
    buttonGlow: {
      shadowColor: logoColors.cian,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
  };
}

/**
 * Sin `organization` en contexto (logout o carga): grises + acento slate, sin cian Waitomo.
 * Reduce flashes llamativos al cerrar sesión o antes de hidratar la org.
 */
function getThemeTokensNeutralShell(mode) {
  const isDark = mode !== 'light';
  const accent = '#64748b';
  if (isDark) {
    return {
      bg: '#050a0d',
      text: '#f1f5f9',
      subText: '#94a3b8',
      placeholder: '#64748b',
      place: '#64748b',
      empty: '#94a3b8',
      border: 'rgba(148,163,184,0.35)',
      brand: accent,
      overlayBg: 'rgba(148,163,184,0.12)',
      overlayBorder: 'rgba(148,163,184,0.35)',
      boxBg: 'rgba(148,163,184,0.1)',
      inputBg: 'rgba(148,163,184,0.12)',
      faint: 'rgba(241,245,249,0.06)',
      faintStrong: 'rgba(241,245,249,0.1)',
      primaryText: colors.buttons.primaryText.color,
      onBrand: colors.dark.buttonText,
      brand2: '#cbd5e1',
      danger: colors.brand.danger,
      buttonPrimary: {
        backgroundColor: hexToRgba(accent, 0.2),
        borderColor: accent,
        borderWidth: 1,
      },
      buttonPrimaryText: colors.buttons.primaryText,
      buttonDanger: colors.buttons.danger,
      buttonDangerText: colors.buttons.dangerText,
      activeTabBg: hexToRgba(accent, 0.28),
      inactiveTabBg: 'rgba(148,163,184,0.1)',
      borderStrong: accent,
      screenOverlay: 'rgba(0,0,0,0.35)',
      segmentInactiveBg: 'rgba(241,245,249,0.08)',
      segmentInactiveText: '#cbd5e1',
      brandText: '#f1f5f9',
      brandTextShadow: 'rgba(0,0,0,0.35)',
      metallicGrey: logoColors.metallicGrey,
      logoCian: accent,
      buttonGlow: {
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
      },
    };
  }
  return {
    bg: '#f8fafc',
    text: '#0f172a',
    subText: '#475569',
    placeholder: '#64748b',
    place: '#64748b',
    empty: '#64748b',
    border: '#cbd5e1',
    brand: accent,
    overlayBorder: '#e2e8f0',
    overlayBg: 'rgba(255,255,255,0.85)',
    boxBg: '#ffffff',
    inputBg: '#ffffff',
    faint: 'rgba(15,23,42,0.04)',
    faintStrong: 'rgba(15,23,42,0.08)',
    primaryText: colors.buttons.primaryTextLight.color,
    onBrand: colors.light.buttonText,
    brand2: '#475569',
    danger: colors.brand.danger,
    buttonPrimary: {
      backgroundColor: hexToRgba(accent, 0.35),
      borderColor: accent,
      borderWidth: 1,
    },
    buttonPrimaryText: colors.buttons.primaryTextLight,
    buttonDanger: colors.buttons.danger,
    buttonDangerText: colors.buttons.dangerText,
    activeTabBg: hexToRgba(accent, 0.22),
    inactiveTabBg: '#f1f5f9',
    borderStrong: accent,
    screenOverlay: 'rgba(15,23,42,0.06)',
    segmentInactiveBg: '#f1f5f9',
    segmentInactiveText: '#475569',
    brandText: '#0f172a',
    brandTextShadow: 'rgba(15,23,42,0.08)',
    metallicGrey: logoColors.metallicGrey,
    logoCian: accent,
    buttonGlow: {
      shadowColor: 'rgba(15,23,42,0.15)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 10,
      elevation: 3,
    },
  };
}

/**
 * Presets multi-org: vivid vs minimal vs clean vs warm deben notarse sin depender solo del acento.
 * Tipografía: `features.text_color` + opcional `features.text_secondary_color` (sin mezclas arbitrarias).
 */
function getThemeTokensWithBranding(mode, org) {
  const isDark = mode !== 'light';
  const accent = (org?.accent_color || '#00dddd').toString().trim() || '#00dddd';
  const presetRaw = org?.theme_preset || 'dark_vivid';
  const primaryCustom = resolveOrgTextColor(org);
  const secondaryCustom = resolveOrgSecondaryTextColor(org);

  const darkKey = presetRaw === 'dark_minimal' ? 'dark_minimal' : 'dark_vivid';
  const lightKey = presetRaw === 'light_warm' ? 'light_warm' : 'light_clean';

  const applyTypographyOverride = (base) => {
    const neutral = isDark ? '#94a3b8' : '#64748b';
    const neutralSoft = isDark ? '#64748b' : '#94a3b8';
    if (!primaryCustom && !secondaryCustom) return base;
    const next = { ...base };
    const primaryEffective = adaptTextColorForMode(primaryCustom, isDark, 'primary');
    const secondaryEffective = adaptTextColorForMode(secondaryCustom, isDark, 'secondary');
    if (primaryCustom) {
      next.text = primaryEffective || primaryCustom;
    }
    if (secondaryCustom) {
      next.subText = secondaryEffective || secondaryCustom;
      next.placeholder = mixHex(next.subText, neutralSoft, 0.38);
      next.place = next.placeholder;
      next.empty = mixHex(next.subText, neutralSoft, 0.32);
      next.segmentInactiveText = mixHex(next.subText, neutral, 0.28);
    } else if (primaryCustom) {
      next.subText = mixHex(next.text, neutral, 0.42);
      next.placeholder = mixHex(next.text, neutralSoft, 0.52);
      next.place = next.placeholder;
      next.empty = mixHex(next.text, neutralSoft, 0.45);
      next.segmentInactiveText = mixHex(next.text, neutral, 0.32);
    }
    // Títulos “de marca” y segunda jerarquía: que sigan el texto configurado, no el acento del preset.
    if (primaryCustom) {
      next.brandText = next.text;
      next.brandTextShadow = isDark ? 'rgba(0,0,0,0.42)' : 'rgba(15,23,42,0.1)';
    }
    if (primaryCustom || secondaryCustom) {
      next.brand2 = next.subText;
    }
    return next;
  };

  if (isDark) {
    // Oscuro vivo: mismo tono de texto secundario que Waitomo base (#20b); el acento va en marca/botones/paneles, no en párrafos “azul cielo”.
    const vivid = {
      bg: colors.dark.background,
      text: colors.dark.textPrimary,
      subText: colors.dark.textSecondary,
      placeholder: colors.dark.placeholder,
      place: colors.dark.placeholder,
      empty: colors.dark.emptyMessage,
      border: accent,
      brand: accent,
      overlayBg: hexToRgba(accent, 0.32),
      overlayBorder: hexToRgba(accent, 0.62),
      boxBg: hexToRgba(accent, 0.34),
      inputBg: hexToRgba(accent, 0.22),
      faint: hexToRgba(colors.dark.textPrimary, 0.06),
      faintStrong: hexToRgba(colors.dark.textPrimary, 0.12),
      primaryText: colors.buttons.primaryText.color,
      onBrand: colors.dark.buttonText,
      brand2: accent,
      danger: colors.brand.danger,
      buttonPrimary: {
        backgroundColor: hexToRgba(accent, 0.26),
        borderColor: accent,
        borderWidth: 2,
      },
      buttonPrimaryText: colors.buttons.primaryText,
      buttonDanger: colors.buttons.danger,
      buttonDangerText: colors.buttons.dangerText,
      activeTabBg: hexToRgba(accent, 0.4),
      inactiveTabBg: hexToRgba(accent, 0.2),
      borderStrong: accent,
      screenOverlay: 'rgba(0,0,0,0.42)',
      segmentInactiveBg: hexToRgba(colors.dark.textPrimary, 0.12),
      segmentInactiveText: colors.dark.textPrimary,
      brandText: colors.brand.primary,
      brandTextShadow: 'rgba(0,255,252,0.5)',
      metallicGrey: logoColors.metallicGrey,
      logoCian: accent,
      buttonGlow: {
        shadowColor: logoColors.cian,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
      },
    };

    // Oscuro minimal: casi monocromo zinc, acento solo en acciones; sin “neon” en textos
    const minimal = {
      bg: '#18181b',
      text: '#fafafa',
      subText: '#a1a1aa',
      placeholder: '#71717a',
      place: '#71717a',
      empty: '#a1a1aa',
      border: 'rgba(255,255,255,0.1)',
      brand: accent,
      overlayBg: 'rgba(255,255,255,0.035)',
      overlayBorder: 'rgba(255,255,255,0.09)',
      boxBg: 'rgba(255,255,255,0.045)',
      inputBg: 'rgba(255,255,255,0.055)',
      faint: 'rgba(255,255,255,0.03)',
      faintStrong: 'rgba(255,255,255,0.07)',
      primaryText: colors.buttons.primaryText.color,
      onBrand: colors.dark.buttonText,
      brand2: accent,
      danger: colors.brand.danger,
      buttonPrimary: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderColor: hexToRgba(accent, 0.55),
        borderWidth: 1,
      },
      buttonPrimaryText: colors.buttons.primaryText,
      buttonDanger: colors.buttons.danger,
      buttonDangerText: colors.buttons.dangerText,
      activeTabBg: hexToRgba(accent, 0.12),
      inactiveTabBg: 'rgba(255,255,255,0.04)',
      borderStrong: 'rgba(255,255,255,0.14)',
      screenOverlay: 'rgba(0,0,0,0.22)',
      segmentInactiveBg: 'rgba(255,255,255,0.05)',
      segmentInactiveText: '#d4d4d8',
      brandText: accent,
      brandTextShadow: 'rgba(0,0,0,0.35)',
      metallicGrey: logoColors.metallicGrey,
      logoCian: accent,
      buttonGlow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 2,
      },
    };

    const base = darkKey === 'dark_minimal' ? minimal : vivid;
    const withUi = applySurfaceBorderUiOverride(base, true, org);
    return applyTypographyOverride(withUi);
  }

  // Claro limpio: frío, tarjetas blancas, sombra “SaaS”
  const clean = {
    bg: '#eef2f7',
    text: '#0f172a',
    subText: '#334155',
    placeholder: '#64748b',
    place: '#64748b',
    empty: '#64748b',
    border: '#cbd5e1',
    brand: accent,
    overlayBorder: '#e2e8f0',
    overlayBg: 'rgba(255,255,255,0.75)',
    boxBg: '#ffffff',
    inputBg: '#ffffff',
    faint: 'rgba(15,23,42,0.035)',
    faintStrong: 'rgba(15,23,42,0.07)',
    primaryText: colors.buttons.primaryTextLight.color,
    onBrand: colors.light.buttonText,
    brand2: accent,
    danger: colors.brand.danger,
    buttonPrimary: {
      backgroundColor: hexToRgba(accent, 0.38),
      borderColor: accent,
      borderWidth: 1.5,
    },
    buttonPrimaryText: colors.buttons.primaryTextLight,
    buttonDanger: colors.buttons.danger,
    buttonDangerText: colors.buttons.dangerText,
    activeTabBg: hexToRgba(accent, 0.28),
    inactiveTabBg: '#ffffff',
    borderStrong: accent,
    screenOverlay: 'rgba(15,23,42,0.06)',
    segmentInactiveBg: '#f1f5f9',
    segmentInactiveText: '#475569',
    brandText: accent,
    brandTextShadow: 'rgba(15,23,42,0.08)',
    metallicGrey: logoColors.metallicGrey,
    logoCian: accent,
    buttonGlow: {
      shadowColor: 'rgba(15,23,42,0.12)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 4,
    },
  };

  // Claro cálido: crema, bordes melocotón, jerarquía marrón
  const warm = {
    bg: '#faf5f0',
    text: '#431407',
    subText: '#7c2d12',
    placeholder: '#9a3412',
    place: '#9a3412',
    empty: '#9a3412',
    border: '#fdba74',
    brand: accent,
    overlayBorder: '#fed7aa',
    overlayBg: hexToRgba(accent, 0.08),
    boxBg: '#fffdfb',
    inputBg: '#ffffff',
    faint: 'rgba(124,45,18,0.06)',
    faintStrong: 'rgba(124,45,18,0.1)',
    primaryText: colors.buttons.primaryTextLight.color,
    onBrand: colors.light.buttonText,
    brand2: accent,
    danger: colors.brand.danger,
    buttonPrimary: {
      backgroundColor: hexToRgba(accent, 0.36),
      borderColor: accent,
      borderWidth: 1.5,
    },
    buttonPrimaryText: colors.buttons.primaryTextLight,
    buttonDanger: colors.buttons.danger,
    buttonDangerText: colors.buttons.dangerText,
    activeTabBg: hexToRgba(accent, 0.26),
    inactiveTabBg: '#fff7ed',
    borderStrong: accent,
    screenOverlay: 'rgba(124,45,18,0.06)',
    segmentInactiveBg: '#ffedd5',
    segmentInactiveText: '#9a3412',
    brandText: accent,
    brandTextShadow: 'rgba(124,45,18,0.1)',
    metallicGrey: logoColors.metallicGrey,
    logoCian: accent,
    buttonGlow: {
      shadowColor: accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 3,
    },
  };

  const base = lightKey === 'light_warm' ? warm : clean;
  const withUi = applySurfaceBorderUiOverride(base, false, org);
  return applyTypographyOverride(withUi);
}

/**
 * Tokens del modo efectivo. Si no hay org o es Waitomo → tokens fijos Waitomo.
 * Si hay otra org → preset + accent_color (#20b).
 */
function getThemeTokens(mode, orgBranding = null) {
  if (!orgBranding || isWaitomoOrg(orgBranding)) return getThemeTokensBase(mode);
  return getThemeTokensWithBranding(mode, orgBranding);
}

export { hexToRgba, getThemeTokens, getThemeTokensBase, getThemeTokensNeutralShell, isWaitomoOrg };
