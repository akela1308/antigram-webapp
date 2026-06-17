/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#140E0A',
        'bg-warm': '#1E1510',
        amber: '#C9843E',
        brown: '#A0622A',
        text: '#E8D5C0',
        'text-muted': '#8A6A50',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      screens: {
        sm: '480px',
      },
    },
  },
  plugins: [],
}
