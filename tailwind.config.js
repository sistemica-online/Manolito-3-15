/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Fuente técnica para datos
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['system-ui', 'sans-serif'],
      },
      colors: {
        // Paleta Dark Mode F1
        'race-dark': '#0b0c15',   // Fondo casi negro
        'race-card': '#151621',   // Fondo tarjetas
        'neon-blue': '#00f2ff',   // Cian eléctrico (Datos)
        'neon-green': '#00ff9d',  // Verde éxito
        'neon-red': '#ff0055',    // Rojo alerta
        'neon-amber': '#ffb700',  // Ámbar aviso
      },
      boxShadow: {
        'neon': '0 0 10px rgba(0, 242, 255, 0.3)',
      }
    },
  },
  plugins: [],
}