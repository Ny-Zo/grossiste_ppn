import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'Grossiste PPN',
        short_name: 'Grossiste',
        description: 'Gestion hors ligne de votre commerce de gros PPN.',
        theme_color: '#173f35',
        background_color: '#f4f5ef',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      }
    })
  ],
  server: { port: 5173 },
  preview: { port: 4173 }
});