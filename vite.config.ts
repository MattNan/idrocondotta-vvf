import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Percorsi relativi: la build funziona sia servita dalla radice sia da una
  // sottocartella (es. GitHub Pages su /idrocondotta-vvf/).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // App installabile e utilizzabile senza rete: in montagna il telefono non
    // prende, ma il calcolo deve funzionare lo stesso. Il service worker
    // precarica tutta la build (HTML, JS, CSS, icone) alla prima apertura.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Il manifest è già in public/manifest.json: non lo rigeneriamo.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // xlsx + chart.js: la build resta sotto i 2 MB, ma teniamo margine.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  server: {
    port: 3000,
    host: true
  }
});
