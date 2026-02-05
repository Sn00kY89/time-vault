/** @type {import('tailwindcss').Config} */
export default {
  // MODIFICA: Questa riga abilita il dark mode manuale tramite classe
  darkMode: 'class', 
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}