import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config. The dev server proxies /api, /graphql, /rpc, /events to the
// backend so the frontend can call relative URLs in dev and use VITE_API_URL
// in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/graphql': { target: 'http://localhost:4000', changeOrigin: true },
      '/rpc': 'http://localhost:4000',
      '/events': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
