/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Dark Mode F1
        'f1-bg': '#0f172a', // Slate 900
        'f1-card': '#1e293b', // Slate 800
        'f1-accent': '#10b981', // Emerald 500 (Verde semáforo)
        'f1-alert': '#f43f5e', // Rose 500 (Rojo freno)
        'f1-warn': '#f59e0b', // Amber 500
        'f1-tech': '#06b6d4', // Cyan 500 (Datos técnicos)
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}