import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Sourcemap tersembunyi: tidak diunduh browser (tanpa comment //#sourceMappingURL),
  // tapi tersedia untuk diunggah ke PostHog via CI agar stack error terbaca.
  build: {
    sourcemap: 'hidden',
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        ws: true,
      },
    },
  },
})
