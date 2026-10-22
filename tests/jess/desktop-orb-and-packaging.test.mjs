import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('packaged Windows app unpacks and resolves the Jess PowerShell sidecar', () => {
  const builder = read('../../electron-builder.yml');
  const bridge = read('../../electron/agentBridge.cjs');
  assert.match(builder, /asarUnpack:[\s\S]*electron\/jess-agent\.ps1/);
  assert.match(bridge, /app\.asar\.unpacked/);
  assert.match(bridge, /existsSync\(scriptPath\)/);
});

test('desktop Jess character loads bundled animations in an offline companion window', () => {
  const main = read('../../electron/main.cjs');
  const page = read('../../electron/jess-pet/index.html');
  const style = read('../../electron/jess-pet/pet.css');
  const pet = read('../../electron/jess-pet/pet.js');
  const manifest = read('../../electron/jess-pet/manifest.js');
  const preload = read('../../electron/jess-pet/preload.cjs');
  assert.match(main, /const JESS_PET_WIDTH = 260/);
  assert.match(main, /const JESS_PET_HEIGHT = 300/);
  assert.match(main, /loadFile\(path\.join\(__dirname, 'jess-pet', 'index\.html'\)\)/);
  assert.doesNotMatch(main, /loadURL\(APP_URL \+ '\/companion'\)/);
  assert.match(main, /mainWindow\.on\('show', \(\) => \{ createCompanionWindow\(\); positionCompanionBottomRightIfNeeded\(\); \}\)/);
  assert.match(page, /jess-canvas/);
  assert.match(page, /data-state="walk"/);
  assert.match(style, /background: transparent/);
  assert.match(pet, /manifest\.rowAssets\.map\(loadImage\)/);
  assert.doesNotMatch(pet, /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//);
  for (const state of ['idle', 'walk', 'run', 'jump', 'think', 'tired', 'celebrate']) {
    assert.match(manifest, new RegExp(state + ':'));
  }
  assert.match(main, /hubmind:pet-move-by/);
  assert.match(main, /hubmind:pet-hide/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('jessPet'/);
});

test('screen sharing uses Electron capture plumbing and a thumbnail source picker', () => {
  const main = read('../../electron/main.cjs');
  const handlerStart = main.indexOf('setDisplayMediaRequestHandler');
  const handlerEnd = main.indexOf('const stopHotkeyRegistered', handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  const handler = main.slice(handlerStart, handlerEnd);
  assert.match(handler, /desktopCapturer\.getSources/);
  assert.match(handler, /chooseDisplaySource\(unique\)/);
  assert.match(main, /screen-share-picker\.html/);
  assert.match(handler, /thumbnailSize: \{ width: 320, height: 180 \}/);
  assert.match(handler, /callback\(selected \? \{ video: selected \} : \{\}\)/);
});

test('workspace palette remains pinned to Hub-Mind dark colors', () => {
  const css = read('../../src/index.css');
  const html = read('../../index.html');
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /background-color:\s*#020617/);
  assert.match(html, /theme-color" content="#020617"/);
});

test('desktop action responses distinguish verified from unverified input', () => {
  const tools = read('../../src/lib/jessTools.ts');
  assert.match(tools, /done_verified/);
  assert.match(tools, /sent_unverified/);
  assert.match(tools, /Do not repeat non-idempotent actions automatically/);
});


test('Gemini Live ephemeral tokens use the SDK-supported API version', () => {
  const client = read('../../src/services/liveAudioClient.ts');
  assert.match(client, /apiKey:\s*token[\s\S]{0,100}apiVersion:\s*'v1alpha'/);
  assert.doesNotMatch(client, /apiKey:\s*token[\s\S]{0,100}apiVersion:\s*'v1beta'/);
});


test('Live token endpoints mint short-lived tokens without overriding browser session setup', () => {
  const netlify = read('../../netlify/functions/live-token.mjs');
  const server = read('../../server.ts');
  for (const source of [netlify, server]) {
    assert.ok(source.includes('v1beta/auth_tokens'));
    assert.ok(source.includes('newSessionExpireTime'));
    assert.ok(!source.includes('liveConnectConstraints'));
    assert.ok(!source.includes('bidiGenerateContentSetup'));
  }
});
