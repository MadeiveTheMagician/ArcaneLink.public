import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.ARCANELINK_API_TARGET ?? 'http://localhost:5207'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '^/api(/|$)': apiTarget,
      '^/hubs(/|$)': {
        target: apiTarget,
        ws: true,
      },
      '/ping': apiTarget,
    },
  },
})
