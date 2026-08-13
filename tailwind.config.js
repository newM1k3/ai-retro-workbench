/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        terminal: ['VT323', '"Courier New"', 'monospace'],
        label: ['Helvetica', 'Arial', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
