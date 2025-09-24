import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/sala-caleu/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // Manifest incluido aquí para que Pages la considere instalable
      manifest: {
        name: 'Sala Caleu',
        short_name: 'Sala Caleu',
        start_url: '/sala-caleu/',
        scope: '/sala-caleu/',
        display: 'standalone',
        theme_color: '#0ea5e9',
        background_color: '#0ea5e9',
        icons: [
          // Asegúrate de crear estos archivos en /public/icons/ (te los paso en el próximo paso)
          { src: '/sala-caleu/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/sala-caleu/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/sala-caleu/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },

      // Cache seguro: app-shell en origen; NUNCA cachear Google Calendar
      workbox: {
        navigateFallback: '/sala-caleu/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 3
            }
          },
          {
            // Evitar cachear APIs de Google (calendar, identity)
            urlPattern: ({ url }) =>
              url.origin.includes('googleapis.com') ||
              url.origin.includes('gstatic.com') ||
              url.origin.includes('accounts.google.com'),
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
})
