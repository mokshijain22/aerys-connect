import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        violet: {
          DEFAULT: '#6C5CE7',
          light: '#8B7CF8',
          dim: 'rgba(108,92,231,0.10)',
          deep: '#241E52',
          mid: '#4A3DA8',
        },
        amber: '#F5A623',
        bg: '#F8F8FC',
        border: 'rgba(30,20,60,0.07)',
        muted: '#6B7280',
        ink: '#1A1A2E',
        good: '#34C759',
        warn: '#FF6B6B',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      breakpoints: {
        xs: '320px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
} satisfies Config;
