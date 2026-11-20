import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api requests are proxied to the Express backend (port 5000),
// so the browser sees a single origin and no CORS configuration is needed.
const proxy = { '/api': { target: 'http://localhost:5000', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
});
