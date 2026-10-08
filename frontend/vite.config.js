import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward any /api call from the page to the Express backend
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
})
