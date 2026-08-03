const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

const runtimeCacheAdd = `
            {
              urlPattern: /\\/api\\/tasks/i,
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
              urlPattern: /^https:\\/\\/fonts\\.googleapis\\.com\\/.*/i,`;

code = code.replace(
  `{
              urlPattern: /^https:\\/\\/fonts\\.googleapis\\.com\\/.*/i,`,
  runtimeCacheAdd
);

const shareTargetAdd = `
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
          }`;

code = code.replace(
  /icons:\s*\[[\s\S]*?\]/,
  shareTargetAdd
);

fs.writeFileSync('vite.config.ts', code);
