import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#10302A',      // deep bottle green: text, headers
        leaf: '#1F7A4D',     // primary action
        saffron: '#F2A900',  // offers / highlights
        chili: '#C8321F',    // sale and errors
        mist: '#EEF4F0',     // soft section background
        paper: '#F8FAF8',    // page background
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
