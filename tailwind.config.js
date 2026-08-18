/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter'", 'system-ui', '-apple-system', 'sans-serif'],
        display: ["'Plus Jakarta Sans'", "'Inter'", 'sans-serif'],
        mono: ["'JetBrains Mono'", "'Fira Code'", 'monospace'],
      },
      colors: {
        background: {
          base: 'var(--color-background-base)',
          surface: 'var(--color-background-surface)',
          elevated: 'var(--color-background-elevated)',
          hover: 'var(--color-background-hover)',
          glass: 'var(--color-background-glass)',
          'surface-translucent': 'var(--color-background-surface-translucent)',
          nav: 'var(--color-background-nav)',
          'hover-glass': 'var(--color-background-hover-glass)',
        },
        accent: {
          primary: 'var(--color-accent-primary)',
          'primary-hover': 'var(--color-accent-primary-hover)',
          secondary: 'var(--color-accent-secondary)',
          'secondary-hover': 'var(--color-accent-secondary-hover)',
        },
        status: {
          success: 'var(--color-success)',
          'success-bg': 'var(--color-success-bg)',
          warning: 'var(--color-warning)',
          'warning-bg': 'var(--color-warning-bg)',
          error: 'var(--color-error)',
          'error-bg': 'var(--color-error-bg)',
          info: 'var(--color-info)',
          'info-bg': 'var(--color-info-bg)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          disabled: 'var(--color-text-disabled)',
        },
        border: {
          default: 'var(--color-border-default)',
          focus: 'var(--color-border-focus)',
          hover: 'var(--color-border-hover)',
          accent: 'var(--color-border-accent)',
          glass: 'var(--color-border-glass)',
          glow: 'var(--color-border-glow)',
        },
        glow: {
          'accent-soft': 'var(--color-glow-accent-soft)',
          'accent-strong': 'var(--color-glow-accent-strong)',
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-secondary': 'var(--gradient-secondary)',
        'gradient-surface': 'var(--gradient-surface)',
      },
      boxShadow: {
        'glass-sm': 'var(--shadow-sm)',
        'glass-md': 'var(--shadow-md)',
        'glass-lg': 'var(--shadow-lg)',
        'glass-xl': 'var(--shadow-xl)',
        'glass': 'var(--shadow-glass)',
        'glow-accent': 'var(--glow-accent)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        'full': 'var(--radius-full)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
