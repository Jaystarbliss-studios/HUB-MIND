import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        devOptions: {
          enabled: true,
          type: 'module'
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          runtimeCaching: [
            
            {
              urlPattern: /\/api\/tasks/i,
              handler: 'NetworkOnly',
              method: 'POST',
              options: {
                backgroundSync: {
                  name: 'task-sync-queue',
                  options: {
                    maxRetentionTime: 24 * 60 // 24 hours
                  }
                }
              }
            },
            {
              urlPattern: /\/api\/documents/i,
              handler: 'NetworkOnly',
              method: 'POST',
              options: {
                backgroundSync: {
                  name: 'document-sync-queue',
                  options: {
                    maxRetentionTime: 24 * 60 // 24 hours
                  }
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        manifest: {
          name: 'Hub-Mind',
          short_name: 'Hub-Mind',
          description: 'AI-Powered Business Workspace',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          
          icons: [
            { src: '/icon-72x72.png', sizes: '72x72', type: 'image/png' },
            { src: '/icon-96x96.png', sizes: '96x96', type: 'image/png' },
            { src: '/icon-128x128.png', sizes: '128x128', type: 'image/png' },
            { src: '/icon-144x144.png', sizes: '144x144', type: 'image/png' },
            { src: '/icon-152x152.png', sizes: '152x152', type: 'image/png' },
            { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/icon-384x384.png', sizes: '384x384', type: 'image/png' },
            { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ],
          share_target: {
            action: '/share-target',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
              files: [
                {
                  name: 'file',
                  accept: ['image/*', 'text/plain', 'application/pdf', '.docx', '.doc']
                }
              ]
            }
          }
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
