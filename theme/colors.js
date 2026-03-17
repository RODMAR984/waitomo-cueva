// theme/colors.js — punto único de verdad Waitomo
// - Sin literales en JSX: usá estos tokens en todas las screens
// - Botones unificados: outline (fondo translúcido + borde y texto en color), no bloque sólido

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

// Cian y gris del logo FitEngine (logo-navbar) — nodos cian y letras metálicas
export const logoColors = {
  cian: '#90ABB5',       // nodos cian del logo → primary/glow
  metallicGrey: '#9A9D9F', // gris letras → textos secundarios
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

// Tokens por modo para ThemeContext y pantallas (mismo shape en dark/light)
function getThemeTokens(mode) {
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
  // Modo claro: card y filas cyan suave; bordes cyan prendidos; texto tipo brand legible (cyan oscuro)
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

export { hexToRgba, getThemeTokens };
