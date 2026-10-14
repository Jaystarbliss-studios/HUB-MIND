import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const read = (path) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

test('workspace theme remains dark regardless of operating system preference', async () => {
  const css = await read('../../src/index.css');
  assert.match(css, /color-scheme:\s*dark/);
  assert.doesNotMatch(css, /prefers-color-scheme:\s*light/);
  assert.match(css, /background-color:\s*#020617/i);
});

test('desktop companion is a fixed-size movable orb, separate from the transcript', async () => {
  const main = await read('../../electron/main.cjs');
  const page = await read('../../src/pages/CompanionPage.tsx');
  const transcript = await read('../../src/pages/JessTranscriptOverlayPage.tsx');
  assert.ok(main.includes('width: 96, height: 96'));
  assert.ok(main.includes('maxWidth: 96, maxHeight: 96'));
  assert.ok(main.includes("APP_URL + '/companion'"));
  assert.match(main, /movable: false, focusable: false/);
  assert.match(main, /setIgnoreMouseEvents\(true, \{ forward: true \}\)/);
  assert.doesNotMatch(main, /mainWindow\.on\('show', \(\) => \{ if \(companionWindow.*hide/);
  assert.doesNotMatch(main, /mainWindow\.on\('restore', \(\) => \{ if \(companionWindow.*hide/);
  assert.match(page, /JessOrbVisualizer/);
  assert.ok(page.includes('moveCompanionBy'));
  assert.ok(page.includes('onPointerMove'));
  assert.doesNotMatch(page, /jess-transcript|jess-orb-controls|hideCompanion/);
  assert.match(transcript, /setTranscriptOverlayHeight/);
  assert.match(transcript, /jess-transcript-overlay-caption/);
});

test('native system actions use the isolated bridge and a Full Control Session', async () => {
  const main = await read('../../electron/main.cjs');
  const preload = await read('../../electron/preload.cjs');
  const tools = await read('../../src/lib/jessTools.ts');
  assert.match(main, /hubmind:native-action/);
  assert.match(main, /hubmind:full-control-start/);
  assert.match(main, /jess-native-audit\.jsonl/);
  assert.match(main, /nativeAgent\.call/);
  assert.match(main, /assertTrustedSender\(event\)/);
  assert.match(preload, /nativeAction/);
  assert.match(preload, /startFullControl/);
  assert.match(preload, /controlCapability/);
  assert.match(main, /assertControlCapability/);
  assert.match(main, /randomBytes\(32\)/);
  assert.match(tools, /name: 'run_windows_command_native'/);
  assert.match(tools, /name: 'launch_windows_application'/);
  assert.match(tools, /name: 'control_system_volume'/);
  assert.match(tools, /name: 'control_screen_brightness'/);
  assert.match(main, /method === 'media_key'/);
  assert.match(await read('../../electron/jess-agent.ps1'), /'media_key'/);
});

test('desktop display capture supports automatic primary-screen selection and a fallback chooser', async () => {
  const main = await read('../../electron/main.cjs');
  const start = main.indexOf('setDisplayMediaRequestHandler');
  const end = main.indexOf('const stopHotkeyRegistered', start);
  assert.ok(start >= 0 && end > start);
  const handler = main.slice(start, end);
  assert.match(handler, /desktopCapturer\.getSources/);
  assert.match(handler, /useSystemPicker:\s*false/);
  assert.match(handler, /showMessageBox/);
  assert.match(handler, /screen-share-primary-auto-selected/);
  assert.match(handler, /permissionMode === 'everything'/);
  assert.match(handler, /Share app:/);
  assert.match(handler, /callback\(selected \? \{ video: selected \} : \{\}\)/);
});
