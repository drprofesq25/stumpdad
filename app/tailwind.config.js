/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '60%': { opacity: '1', transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        floatY: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-7px)' },
          '40%,80%': { transform: 'translateX(7px)' },
        },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.5)' },
          '50%': { boxShadow: '0 0 0 14px rgba(99,102,241,0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.45s ease-out forwards',
        popIn: 'popIn 0.4s cubic-bezier(0.18,0.89,0.32,1.28) forwards',
        floatY: 'floatY 4s ease-in-out infinite',
        shake: 'shake 0.4s ease-in-out',
        glowPulse: 'glowPulse 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
