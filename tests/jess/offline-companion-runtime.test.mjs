import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => readFile(new URL(path, import.meta.url), 'utf8');

test('Jess companion is created before the remote workspace can finish loading', async () => {
  const main = await read('../../electron/main.cjs');
  assert.match(main, /createCompanionWindow\(true\);\s*createMainWindow\(\);/);
  assert.match(main, /companionWindow\.loadFile\(path\.join\(__dirname, 'jess-companion', 'index\.html'\)\)/);
  assert.doesNotMatch(main, /companionWindow\.loadURL\(APP_URL \+ '\/companion'\)/);
  assert.match(main, /return mainWindow\.loadURL\(APP_URL \+ initialPath\)\.catch/);
  assert.match(main, /transcriptOverlayWindow\.loadURL\(APP_URL \+ '\/companion-transcript'\)\.catch/);
});

test('local companion has a restricted preload and only bounded actions', async () => {
  const main = await read('../../electron/main.cjs');
  const preload = await read('../../electron/companion-preload.cjs');
  assert.match(main, /function assertCompanionSender\(event\)/);
  assert.match(main, /event\.sender !== companionWindow\.webContents/);
  assert.match(main, /event\.senderFrame !== event\.sender\.mainFrame/);
  assert.match(main, /hubmind:jess-companion-action/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('jessCompanion'/);
  assert.match(preload, /hubmind:jess-companion-action/);
  assert.doesNotMatch(preload, /child_process|writeFileSync|execFile|shell\.openExternal/);
});

test('offline animation renderer uses the local manifest and local fallback asset', async () => {
  const html = await read('../../electron/jess-companion/index.html');
  const manifest = await read('../../electron/jess-companion/animation-manifest.js');
  const renderer = await read('../../electron/jess-companion/renderer.js');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /animation-manifest\.js/);
  assert.match(manifest, /fallback: "\.\.\/\.\.\/dist\/icon\.svg"/);
  for (const animation of ['idle', 'listening', 'thinking', 'speaking', 'working', 'waiting_approval', 'success', 'error']) {
    assert.match(manifest, new RegExp(animation + ':'));
  }
  assert.match(renderer, /function playAnimation\(name\)/);
  assert.match(renderer, /function animationForState/);
  assert.match(renderer, /setInteractive\(isInsideHitArea\(event\)\)/);
  assert.doesNotMatch(renderer, /https?:\/\//);
});

test('workspace renderer publishes Jess state and receives safe companion commands', async () => {
  const main = await read('../../electron/preload.cjs');
  const assistant = await read('../../src/components/JessFloatingAssistant.tsx');
  assert.match(main, /publishJessCompanionState/);
  assert.match(main, /onJessCompanionCommand/);
  assert.match(assistant, /publishJessCompanionState/);
  assert.match(assistant, /onJessCompanionCommand/);
});

test('desktop packaging includes the local companion files', async () => {
  const builder = await read('../../electron-builder.yml');
  assert.match(builder, /- electron\/\*\*/);
});
