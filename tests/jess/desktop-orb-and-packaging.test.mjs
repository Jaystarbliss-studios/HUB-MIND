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
  const desktopPreload = read('../../electron/preload.cjs');
  const assistant = read('../../src/components/JessFloatingAssistant.tsx');
  const app = read('../../src/App.tsx');
  const settings = read('../../src/pages/JessSettings.tsx');
  assert.match(main, /const JESS_PET_WIDTH = 130/);
  assert.match(main, /const JESS_PET_HEIGHT = 150/);
  assert.match(main, /loadFile\(path\.join\(__dirname, 'jess-pet', 'index\.html'\)\)/);
  assert.doesNotMatch(main, /loadURL\(APP_URL \+ '\/companion'\)/);
  assert.match(main, /mainWindow\.on\('show', \(\) => \{ createCompanionWindow\(\); positionCompanionBottomRightIfNeeded\(\); \}\)/);
  assert.match(page, /jess-canvas/);
  assert.match(page, /id="character"/);
  assert.match(page, /class="connection-status" id="status"/);
  assert.match(page, /id="jess-visualizer"/);
  assert.doesNotMatch(page, /pet-toolbar|offline-status|offline-ready|data-state="walk"/);
  assert.doesNotMatch(style, /\.pet-toolbar|\.offline-status/);
  assert.match(style, /data-status="connecting"/);
  assert.match(style, /data-status="connected"/);
  assert.match(style, /data-status="error"/);
  assert.match(pet, /requestVoiceActivation\("toggle"\)/);
  assert.match(pet, /gesture === "toggle" && visualState\.connection === "connecting"/);
  assert.match(assistant, /another click won't cancel the attempt/);
  assert.match(pet, /requestVoiceActivation\("mute"\)/);
  assert.match(pet, /function renderVisualizer\(\)/);
  assert.match(pet, /activationWatchdogTimer/);
  assert.match(pet, /Voice chat did not connect/);
  assert.match(pet, /visualState\.inputLevel/);
  assert.match(pet, /visualState\.outputLevel/);
  assert.match(pet, /character\.addEventListener\("contextmenu",[\s\S]*?jessPet\?\.hide/);
  assert.match(pet, /scheduleIdleFidget/);
  assert.match(preload, /hubmind:pet-activate-voice/);
  assert.match(preload, /onVisualState/);
  assert.match(desktopPreload, /onPetVoiceActivation/);
  assert.match(desktopPreload, /setJessPetVisualState/);
  assert.match(main, /hubmind:pet-activate-voice/);
  assert.match(main, /registerJessVisibilityShortcut/);
  assert.match(main, /showCompanion/);
  assert.match(main, /hubmind:pet-voice-activation/);
  assert.match(main, /app\.commandLine\.appendSwitch\(['"]autoplay-policy['"],\s*['"]no-user-gesture-required['"]\)/);
  assert.match(main, /await showMainVerified\(\)/);
  assert.match(main, /label: 'Show Jess character'/);
  assert.match(main, /label: 'Hide Jess character'/);
  assert.match(main, /hubmind:pet-set-visual-state/);
  assert.match(main, /hubmind:pet-visual-state/);
  assert.match(assistant, /getPendingPetVoiceActivation/);
  assert.match(assistant, /setJessPetVisualState/);
  assert.match(assistant, /could not finish connecting after 30 seconds/i);
  assert.match(assistant, /navigate\('\/workspace'/);
  assert.match(app, /publicOrLoginRoute && !isDesktopShell/);
  assert.match(app, /Please sign in to Hub-Mind first/);
  assert.match(settings, /Show Jess character/);
  assert.match(settings, /Show Jess when Hub-Mind opens/);
  assert.match(settings, /Show \/ hide keyboard shortcut/);
  assert.match(settings, /petHotkey/);
  assert.match(read('../../src/components/Layout.tsx'), /label: 'Chat with Jess'/);
  assert.match(read('../../src/App.tsx'), /path="jess-chat"/);
  assert.doesNotMatch(read('../../src/components/DesktopSidebar.tsx'), /Admin Centre Link/);
  assert.match(settings, /Hide Jess character/);
  assert.match(assistant, /clientRef\.current\.toggleMute\(\)/);
  assert.match(assistant, /activate\(\);/);
  assert.match(style, /background: transparent/);
  assert.match(pet, /manifest\.rowAssets\.map\(loadImage\)/);
  assert.match(pet, /image\.naturalWidth \/ manifest\.columns/);
  assert.match(pet, /sourceFrameHeight = image\.naturalHeight/);
  assert.match(pet, /cellWidth !== image\.naturalHeight/);
  assert.match(manifest, /columns: 5/);
  assert.doesNotMatch(manifest, /frameWidth: 128|frameHeight: 128/);
  assert.doesNotMatch(pet, /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//);
  for (const state of ['idle', 'walk', 'run', 'jump', 'think', 'tired', 'celebrate']) {
    assert.match(manifest, new RegExp(state + ':'));
  }
  assert.match(main, /hubmind:pet-move-by/);
  assert.match(main, /hubmind:pet-hide/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('jessPet'/);
});

test('all Jess WebP strips contain five square frames, including mixed-resolution walk poses', () => {
  const readBytes = (path) => readFileSync(new URL(path, import.meta.url));
  for (let row = 0; row < 6; row += 1) {
    const asset = readBytes(`../../electron/jess-pet/assets/rows/jess-row-${row}.webp`);
    assert.equal(asset.toString('ascii', 0, 4), 'RIFF', `row ${row} is a valid RIFF file`);
    assert.equal(asset.toString('ascii', 8, 12), 'WEBP', `row ${row} is WebP`);
    assert.equal(asset.toString('ascii', 12, 16), 'VP8X', `row ${row} has an extended WebP header`);
    const width = asset.readUIntLE(24, 3) + 1;
    const height = asset.readUIntLE(27, 3) + 1;
    assert.equal(width % 5, 0, `row ${row} width divides into five frames`);
    assert.equal(width / 5, height, `row ${row} uses square frames`);
  }
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
