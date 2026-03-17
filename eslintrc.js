module.exports = {
  plugins: ['react', 'react-native'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-native/all',
  ],
  rules: {
    // 🚫 Texto suelto fuera de <Text>
    'react-native/no-raw-text': 'error',

    // 🚫 Colores literales (hex o rgba)
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "Literal[value=/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})/]",
        message: 'Usá colors.js, no hex literal.',
      },
      {
        selector:
          "Literal[value=/rgba?\\(/]",
        message: 'Usá hexToRgba(colors.brand.primary, …), no rgba literal.',
      },
    ],

    // 🚫 Estilos inline directos
    'react-native/no-inline-styles': 'error',

    // ⚠️ Importar colors sin usar colors.dark o colors.brand
    'no-restricted-imports': [
      'error',
      {
        name: '../colors',
        message:
          'Importá colors correctamente: colors.dark o colors.brand según el modo.',
      },
    ],

    // 💡 Mejor legibilidad de JSX
    'react/jsx-max-props-per-line': ['warn', { maximum: 1 }],
    'react/jsx-first-prop-new-line': ['warn', 'multiline'],
  },
  settings: {
    react: { version: 'detect' },
  },
};
