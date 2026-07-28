/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#102033',
        muted: '#64748b',
        swat: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#99f6e4',
          500: '#0f766e',
          600: '#0f5f5a',
          700: '#115e59',
          800: '#134e4a',
          900: '#123433',
        },
      },
      boxShadow: {
        panel: '0 20px 50px rgba(15, 23, 42, 0.08)',
        premium: '0 24px 70px rgba(15, 23, 42, 0.14)',
      },
    },
  },
  plugins: [],
};
