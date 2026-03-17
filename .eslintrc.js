module.exports = {
  plugins: ['react', 'react-native'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-native/all',
  ],
  settings: {
    react: { version: 'detect' }, // <- quita el warning
  },
  rules: {
    // 🔒 Normas Waitomo (se mantienen duras)
    'react-native/no-raw-text': 'error',
    'react-native/no-inline-styles': 'error',
    'no-restricted-syntax': [
      'error',
      { selector: "Literal[value=/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})/]", message: 'Usá colors.js, no hex literal.' },
      { selector: "Literal[value=/rgba?\\(/]", message: 'Usá hexToRgba(colors.brand.primary, …), no rgba literal.' },
    ],

    // 👇 Ruido que apagamos para avanzar
    'react/prop-types': 'off',
    'react-native/no-unused-styles': 'off',
    'react-native/sort-styles': 'off',

    // Sugerencias de legibilidad (no bloquean)
    'react/jsx-max-props-per-line': ['warn', { maximum: 1 }],
    'react/jsx-first-prop-new-line': ['warn', 'multiline'],
  },
};
