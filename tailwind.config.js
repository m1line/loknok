/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6fe',
          100: '#d9ebfc',
          200: '#bcdcfa',
          300: '#8ec6f7',
          400: '#59a8f2',
          500: '#3390ec',
          600: '#2478d6',
          700: '#1d62b0',
          800: '#1d5290',
          900: '#1f456f',
        },
      },
    },
  },
  plugins: [],
};
