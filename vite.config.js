import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      // Proxy Square API calls through our Express backend (handles OAuth token)
      '/api/square': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy OAuth endpoints to Express backend
      '/api/square-oauth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    }
  }
})
