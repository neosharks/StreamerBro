/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090d',
          900: '#0b0d13',
          850: '#10131c',
          800: '#151925',
          700: '#1c2130',
          600: '#2a3042',
        },
        brand: {
          DEFAULT: '#e50914',
          400: '#f6121d',
          500: '#e50914',
          600: '#b1060f',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 8px 40px -8px rgba(229,9,20,0.5)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .25s ease' },
    },
  },
  plugins: [],
}
