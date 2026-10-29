import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo, las llamadas a /api se reenvían al backend (puerto 3000): el navegador solo habla con el
// backend y NUNCA con MongoDB o Neo4j directamente.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_API_TARGET ?? 'http://localhost:3000', changeOrigin: true, timeout: 180_000 } },
  },
});
