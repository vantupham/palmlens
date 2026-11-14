import { defineConfig } from 'vite';

// Site is served from https://vantupham.github.io/palmlens/
export default defineConfig({
  base: '/palmlens/',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});
