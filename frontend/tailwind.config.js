/** @type {import('tailwindcss').Config} */
// tailwind.config.js — HRPulse
// All color/radius/font values read from tokens.css CSS custom properties.
// NO raw hex values here — the var() references are intentional.
// If you need a new token: add it to tokens.css first, then wire it here.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand ──────────────────────────────────────────────────
        primary:           'var(--color-primary)',
        'primary-hover':   'var(--color-primary-hover)',
        'primary-light':   'var(--color-primary-light)',

        // ── Accent ─────────────────────────────────────────────────
        accent:            'var(--color-accent)',

        // ── Semantic ───────────────────────────────────────────────
        success:           'var(--color-success)',
        'success-light':   'var(--color-success-light)',
        warning:           'var(--color-warning)',
        'warning-light':   'var(--color-warning-light)',
        error:             'var(--color-error)',
        'error-light':     'var(--color-error-light)',

        // ── Neutrals ───────────────────────────────────────────────
        bg:                'var(--color-bg)',
        surface:           'var(--color-surface)',
        border:            'var(--color-border)',
        text:              'var(--color-text)',
        'text-muted':      'var(--color-text-muted)',
        'text-inverse':    'var(--color-text-inverse)',
      },

      fontFamily: {
        sans: ['var(--font-sans)'],
      },

      borderRadius: {
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        full: 'var(--radius-full)',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },

      spacing: {
        // Explicit token aliases (on top of Tailwind's default scale)
        '1t':  'var(--space-1)',
        '2t':  'var(--space-2)',
        '3t':  'var(--space-3)',
        '4t':  'var(--space-4)',
        '6t':  'var(--space-6)',
        '8t':  'var(--space-8)',
        '12t': 'var(--space-12)',
        '16t': 'var(--space-16)',
      },

      fontSize: {
        xs:   ['var(--font-size-xs)',   { lineHeight: '1rem' }],
        sm:   ['var(--font-size-sm)',   { lineHeight: '1.25rem' }],
        base: ['var(--font-size-base)', { lineHeight: '1.5rem' }],
        lg:   ['var(--font-size-lg)',   { lineHeight: '1.75rem' }],
        xl:   ['var(--font-size-xl)',   { lineHeight: '1.75rem' }],
        '2xl':['var(--font-size-2xl)',  { lineHeight: '2rem' }],
        '3xl':['var(--font-size-3xl)',  { lineHeight: '2.25rem' }],
      },
    },
  },
  plugins: [],
};
