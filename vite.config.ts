import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
