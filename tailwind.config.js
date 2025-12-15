/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Esta es la fuente digital que hace que los números queden guapos
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['system-ui', 'sans-serif'],
      },
      colors: {
        // AQUÍ ESTÁ LA CLAVE: Definimos los colores "Race"
        // Si no tienes esto, la web se verá blanca y rota.
        'race-dark': '#0b0c15',   // Fondo negro profundo
        'race-card': '#151621',   // Fondo de las tarjetas
        'neon-blue': '#00f2ff',   // Azul Cian Eléctrico
        'neon-green': '#00ff9d',  // Verde Semáforo
        'neon-red': '#ff0055',    // Rojo Alerta
        'neon-amber': '#ffb700',  // Ámbar
      },
      boxShadow: {
        'neon': '0 0 10px rgba(0, 242, 255, 0.3)',
      }
    },
  },
  plugins: [],
}