/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#6366f1', // Indigo 500
        secondary: '#1e293b', // Slate 800
        surface: '#0f172a', // Slate 900
      }
    },
  },
  plugins: [],
}