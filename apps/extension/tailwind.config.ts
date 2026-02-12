import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{ts,tsx,html}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
