/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary colors
        primary: {
          DEFAULT: '#6366f1',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Secondary colors
        secondary: {
          DEFAULT: '#8b5cf6',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Accent colors
        accent: {
          DEFAULT: '#10b981',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // Pink colors (replacing blue theme)
        pink: {
          DEFAULT: '#ec4899',
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
          950: '#500724',
        },
        // Background colors
        background: {
          DEFAULT: '#111827',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: 'rgb(var(--tw-surface-500) / <alpha-value>)',
          600: 'rgb(var(--tw-surface-600) / <alpha-value>)',
          700: 'rgb(var(--tw-surface-700) / <alpha-value>)',
          800: 'rgb(var(--tw-surface-800) / <alpha-value>)',
          900: 'rgb(var(--tw-surface-900) / <alpha-value>)',
          950: '#0d1117',
        },
        // Theme-reactive override of Tailwind's default gray scale for the
        // shades this app uses as "muted surface / muted text" — these were
        // hardcoded dark-only values that never adapted to light theme.
        // 50/100/950 are intentionally left as Tailwind defaults (rarely used
        // as theme-reactive surfaces in this codebase).
        gray: {
          200: 'rgb(var(--tw-text-200) / <alpha-value>)',
          300: 'rgb(var(--tw-text-300) / <alpha-value>)',
          400: 'rgb(var(--tw-text-400) / <alpha-value>)',
          500: 'rgb(var(--tw-surface-500) / <alpha-value>)',
          600: 'rgb(var(--tw-surface-600) / <alpha-value>)',
          700: 'rgb(var(--tw-surface-700) / <alpha-value>)',
          800: 'rgb(var(--tw-surface-800) / <alpha-value>)',
          900: 'rgb(var(--tw-surface-900) / <alpha-value>)',
        },
        // Card colors
        card: {
          DEFAULT: '#1f2937',
          light: '#374151',
          dark: '#111827',
        },
        // Success, warning, and error colors
        success: {
          DEFAULT: '#10b981',
          dark: '#047857',
          light: '#a7f3d0',
        },
        warning: {
          DEFAULT: '#f59e0b',
          dark: '#b45309',
          light: '#fde68a',
        },
        error: {
          DEFAULT: '#ef4444',
          dark: '#b91c1c',
          light: '#fecaca',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'Roboto', 'Open Sans', 'Poppins', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      screens: {
        'xs': '475px',
        '3xl': '1600px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [],
};
