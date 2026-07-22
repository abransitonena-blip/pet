const { fontFamily } = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontSize: {
        '2xs': '0.625rem', // 10px
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...fontFamily.sans],
        display: ['var(--font-inter)', ...fontFamily.sans],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#D97706',
          600: '#B45309',
          700: '#92400E',
          800: '#78350F',
          900: '#451A03',
        },
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          400: '#34D399',
          500: '#059669',
          600: '#047857',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          400: '#F87171',
          500: '#DC2626',
          600: '#B91C1C',
        },
        accent: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          400: '#A78BFA',
          500: '#7C3AED',
          600: '#6D28D9',
        },
        surface: {
          0: '#0F172A',
          1: '#1E293B',
          2: '#334155',
          3: '#475569',
          4: '#64748B',
        },
        'surface-light': {
          0: '#F8FAFC',
          1: '#F1F5F9',
          2: '#E2E8F0',
          3: '#CBD5E1',
          4: '#94A3B8',
        },
        primary: '#D97706',
        'primary-dark': '#B45309',
        secondary: '#059669',
        dark: '#0F172A',
        'dark-card': '#1E293B',
        'dark-light': '#334155',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(217, 119, 6, 0.15)',
        'glow-lg': '0 0 40px rgba(217, 119, 6, 0.2)',
        'card': '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
        'card-hover': '0 14px 28px rgba(0,0,0,0.12), 0 10px 10px rgba(0,0,0,0.22)',
        'elevated': '0 20px 60px rgba(0,0,0,0.15)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'scale-in': 'scaleIn 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
