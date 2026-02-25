import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api/redgifs': {
        target: 'https://api.redgifs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/redgifs/, ''),
        headers: {
          'Origin': 'https://www.redgifs.com',
          'Referer': 'https://www.redgifs.com/',
        },
      },
    },
  },
})
