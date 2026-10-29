import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Build "portatile": un unico file HTML con dentro tutto (JavaScript, CSS,
 * icone). Si apre con un doppio clic da chiavetta o dal disco, senza server
 * locale e senza connessione — utile quando il telefono non prende e non c'è
 * un PC su cui pubblicare l'app.
 *
 *   npm run build:portatile   ->  dist-portatile/index.html
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: 'dist-portatile',
    emptyOutDir: true
  }
});
