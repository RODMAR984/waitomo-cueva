/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#90ABB5',   // Cian de los puntos del logo
        'primary-glow': 'rgba(144, 171, 181, 0.4)',
        secondary: '#9A9D9F', // Gris metálico de las letras del logo
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(144, 171, 181, 0.35)',
        'glow-sm': '0 0 12px rgba(144, 171, 181, 0.25)',
      },
    },
  },
  plugins: [],
}
