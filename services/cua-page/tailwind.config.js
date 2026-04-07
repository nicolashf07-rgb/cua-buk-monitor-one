/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'cua-blue': '#1e40af',
        'cua-light': '#dbeafe',
      }
    },
  },
  plugins: [],
}
