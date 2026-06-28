import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build to ./dist, served by Express in production.
// Dev server proxies /api to the Express backend on :8088.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8088',
    },
  },
});
