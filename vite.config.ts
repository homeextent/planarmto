import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    // SiteGround CDN omits JavaScript MIME for .mjs assets. Keep the PDF.js
    // module worker bytes unchanged, but publish them with a .js extension.
    build: {
      rollupOptions: {
        output: {
          assetFileNames: (asset) =>
            asset.names.some(name => name === 'pdf.worker.min.mjs')
              ? 'assets/pdf.worker.min-[hash].js'
              : 'assets/[name]-[hash][extname]',
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
