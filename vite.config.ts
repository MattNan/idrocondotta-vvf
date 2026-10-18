import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Percorsi relativi: la build funziona sia servita dalla radice sia da una
  // sottocartella (es. GitHub Pages su /idrocondotta-vvf/).
  base: './',
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 3000,
    host: true
  }
});
