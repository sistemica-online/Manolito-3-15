/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // La fuente digital "JetBrains Mono"
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['system-ui', 'sans-serif'],
      },
      colors: {
        // AQUÍ ESTÁ LA SOLUCIÓN: Definimos los colores NUEVOS
        'race-dark': '#0b0c15',   // El fondo negro que falta
        'race-card': '#151621',   // El fondo de las tarjetas
        'neon-blue': '#00f2ff',   // Cian eléctrico
        'neon-green': '#00ff9d',  // Verde
        'neon-red': '#ff0055',    // Rojo
        'neon-amber': '#ffb700',  // Ámbar
      },
      boxShadow: {
        'neon': '0 0 10px rgba(0, 242, 255, 0.3)',
      }
    },
  },
  plugins: [],
}