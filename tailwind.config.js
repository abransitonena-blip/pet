const { fontFamily } = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      // Las capas de la interfaz, con los mismos valores que globals.css.
      // Sin esto, `z-sticky` y compañía no generaban nada: quedaban en
      // `z-index: auto`, y el encabezado fijo terminaba debajo de la portada,
      // que se comía todos los clics del menú.
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        overlay: 'var(--z-overlay)',
        preloader: 'var(--z-preloader)',
      },
      /**
       * La escala tipográfica, subida de piso (2026-09-14).
       *
       * Había 151 usos de 10px y 641 de 12px: ilegibles para vista cansada, que
       * es la de buena parte de quien tiene perro y paga por paseos. Se sube lo
       * que esas clases significan en vez de reescribir 800 lugares -- así sube
       * toda la app de una vez y no queda medio proyecto en cada tamaño.
       *
       * El piso absoluto es 12px, y sólo para etiquetas. 14px es el secundario,
       * 16px el cuerpo. Los de arriba no se tocan.
       */
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1rem' }],
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
      },
      fontFamily: {
        sans: ['Manrope', ...fontFamily.sans],
        display: ['Manrope', ...fontFamily.sans],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: '#FFF8F1',
        surface: '#FFFFFF',
        ink: '#172033',
        muted: '#5D6778',
        border: '#808897',
        'brand-soft': '#FFE1CC',
        primary: {
          DEFAULT: 'rgb(var(--brand-500) / <alpha-value>)',
          hover: 'rgb(var(--brand-600) / <alpha-value>)',
          light: 'rgb(var(--brand-500) / 0.1)',
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        trust: {
          DEFAULT: '#0F766E',
          light: 'rgba(15, 118, 110, 0.1)',
          50: '#EDFCFB',
          100: '#D1FAF5',
          400: '#2DD4BF',
          500: '#0F766E',
          600: '#0B5D57',
        },
        success: {
          DEFAULT: '#15803D',
          light: 'rgba(21, 128, 61, 0.1)',
          50: '#ECFDF5',
          100: '#D1FAE5',
          400: '#34D399',
          500: '#15803D',
          600: '#0F6D33',
        },
        warning: {
          DEFAULT: '#B45309',
          light: 'rgba(180, 83, 9, 0.1)',
          50: '#FFFBEB',
          100: '#FEF3C7',
          400: '#FBBF24',
          500: '#B45309',
          600: '#92400E',
        },
        error: {
          DEFAULT: '#B91C1C',
          light: 'rgba(185, 28, 28, 0.1)',
          50: '#FEF2F2',
          100: '#FEE2E2',
          400: '#F87171',
          500: '#B91C1C',
          600: '#991B1B',
        },
        danger: {
          DEFAULT: '#B91C1C',
          light: 'rgba(185, 28, 28, 0.1)',
          400: '#F87171',
          500: '#B91C1C',
          600: '#991B1B',
        },
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        'dark-canvas': '#0B1220',
        'dark-surface': '#141E2F',
        'dark-border': '#29364D',
        'surface-light': {
          0: '#F7F8F4',
          1: '#FFFFFF',
          2: '#F1F3F7',
          3: '#E2E8F0',
          4: '#CBD5E1',
        },
      },
      borderRadius: {
        lg: 'var(--radius-button)',
        xl: 'var(--radius-card)',
        '2xl': 'var(--radius-panel)',
        '3xl': 'var(--radius-sheet)',
        '4xl': 'var(--radius-sheet)',
      },
      boxShadow: {
        'glow': '0 0 20px rgb(var(--brand-500) / 0.15)',
        'glow-lg': '0 0 40px rgb(var(--brand-500) / 0.2)',
        // Keep in step with --shadow-card / --shadow-card-hover in globals.css.
        'card': '0 1px 2px rgba(23, 32, 51, 0.04)',
        'card-hover': '0 8px 24px rgba(23, 32, 51, 0.08)',
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
