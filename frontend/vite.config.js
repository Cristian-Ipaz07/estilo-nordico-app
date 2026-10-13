import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
      '/products': 'http://localhost:8000',
      '/sales': 'http://localhost:8000',
      '/cash': 'http://localhost:8000',
      '/corte': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
      '/webhooks': 'http://localhost:8000',
    },
  },
});
