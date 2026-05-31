/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c0d0ff',
          300: '#91adff',
          400: '#5c7fff',
          500: '#3a5bef',
          600: '#2640d6',
          700: '#1f31b0',
          800: '#1a2a8e',
          900: '#0f1a5c',
          950: '#0a1040',
        },
        slate: {
          850: '#1a2236',
          900: '#111827',
          950: '#0d1117',
        },
        brand: {
          orange: '#f97316',
          'orange-light': '#fb923c',
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
        },
      },
    },
  },
  plugins: [],
};
