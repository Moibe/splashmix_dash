import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/faceid-api': {
        target: 'https://moibe-instantid2.hf.space',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/faceid-api/, ''),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Forzar headers para simular que la petición viene del mismo Space
            proxyReq.setHeader('Origin', 'https://moibe-instantid2.hf.space');
            proxyReq.setHeader('Referer', 'https://moibe-instantid2.hf.space/?__theme=light');
          });
        }
      }
    }
  }
})
