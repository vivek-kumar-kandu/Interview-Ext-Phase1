/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './public/**/*.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#6366f1',
          primaryHover: '#4f46e5',
          secondary: '#06b6d4',
          accent: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
