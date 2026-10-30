import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }],
  },
  // Para compartir el entorno de desarrollo por un túnel (Cloudflare o ngrok): la API y la IA
  // se sirven desde el mismo origen que el frontend (ver frontend/.env.local).
  server: {
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'],
    proxy: {
      '/api': { target: 'http://localhost:4000', rewrite: (path) => path.replace(/^\/api/, '') },
      '/ai': 'http://localhost:4001',
    },
  },
})
