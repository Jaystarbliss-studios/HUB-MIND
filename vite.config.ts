import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'import.meta.env.VITE_FIREBASE_WEB_API_KEY': JSON.stringify(env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_WEB_API_KEY || ''),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || ''),
      'import.meta.env.VITE_FIRESTORE_DATABASE_ID': JSON.stringify(env.FIRESTORE_DATABASE_ID || env.VITE_FIRESTORE_DATABASE_ID || ''),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || ''),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || ''),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET || ''),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID || env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        devOptions: {
          enabled: false
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
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
                  options: { maxRetentionTime: 24 * 60 }
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
                  options: { maxRetentionTime: 24 * 60 }
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
                cacheableResponse: { statuses: [0, 200] }
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
                cacheableResponse: { statuses: [0, 200] }
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
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
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
      }),
      {
        name: 'mirror-build-dir',
        closeBundle() {
          try {
            const distDir = path.resolve(__dirname, 'dist');
            const buildDir = path.resolve(__dirname, 'build');
            if (fs.existsSync(distDir)) {
              fs.cpSync(distDir, buildDir, { recursive: true });
            }
          } catch (e) {
            console.warn('Could not mirror build directory:', e);
          }
        }
      }
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    build: {
      outDir: 'dist',
      // Never retain chunks from previous builds. Keeping stale bundles in dist
      // can make PWA deployments appear to randomly mix old/new application code.
      emptyOutDir: true,
      chunkSizeWarningLimit: 3500,
    },
    server: {
      hmr: false,
      ws: false as const,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
