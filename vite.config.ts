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
      '/media-redgifs': {
        target: 'https://media.redgifs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media-redgifs/, ''),
        headers: {
          'Origin': 'https://www.redgifs.com',
          'Referer': 'https://www.redgifs.com/',
        },
      },
      '/api/gifhq': {
        target: 'https://gifhq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gifhq/, ''),
        headers: {
          'Origin': 'https://gifhq.com',
          'Referer': 'https://gifhq.com/',
        },
      },
      '/api/hardgif': {
        target: 'https://hardgif.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hardgif/, ''),
        headers: {
          'Origin': 'https://hardgif.com',
          'Referer': 'https://hardgif.com/',
        },
      },
      '/api/scrolller': {
        target: 'https://api.scrolller.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/scrolller/, '/api/v2/graphql'),
        headers: {
          'Origin': 'https://scrolller.com',
          'Referer': 'https://scrolller.com/',
        },
      },
      '/api/adultdatalink': {
        target: 'https://api.adultdatalink.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/adultdatalink/, ''),
      },
      '/api/reddit': {
        target: 'https://www.reddit.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/reddit/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) browser-test/1.0',
        },
      },
    },
  },
})
