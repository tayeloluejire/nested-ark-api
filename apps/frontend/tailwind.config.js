/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tell Tailwind where to look for class names — required for tree-shaking
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
  ],
  // Dark mode controlled by data-theme attribute (our ThemeToggle sets this on <html>)
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Expose our CSS variables as Tailwind colours so you can use
        // bg-background, text-foreground, border-border etc. directly
        background:   'var(--background)',
        foreground:   'var(--foreground)',
        card:         'var(--bg-card)',
        'card-hover': 'var(--bg-hover)',
        border:       'var(--border)',
        muted:        'var(--fg-muted)',
      },
      animation: {
        ticker: 'ticker 40s linear infinite',
      },
      keyframes: {
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
