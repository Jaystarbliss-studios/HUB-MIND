import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [main, companion, companionCss, workspaceCss, layout] = await Promise.all([
  readFile(new URL('../../electron/main.cjs', import.meta.url), 'utf8'),
  readFile(new URL('../../src/pages/CompanionPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../src/pages/companion.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/index.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/components/Layout.tsx', import.meta.url), 'utf8'),
]);

test('Windows shell identifies itself as an installed app and exposes a real display-share source picker', () => {
  assert.match(main, /app\.setAppUserModelId\(['"]studios\.jaystarbliss\.hubmind['"]\)/);
  assert.match(main, /setDisplayMediaRequestHandler/);
  assert.match(main, /desktopCapturer\.getSources/);
  assert.match(main, /Choose what Jess can see/);
  assert.match(main, /callback\(selected \? \{ video: selected \} : \{\}\)/);
});

test('Jess desktop overlay keeps the original icon, transcript, click-through and movement controls', () => {
  assert.match(main, /width: 420, height: 560/);
  assert.ok(main.includes('setIgnoreMouseEvents(true, { forward: true })'));
  assert.match(main, /transparent: true/);
  assert.match(main, /alwaysOnTop: true/);
  assert.match(main, /hubmind:move-companion-by/);
  assert.match(main, /hubmind:hide-companion/);
  assert.match(companion, /hideCompanion/);
  assert.match(companion, /moveCompanionBy/);
  assert.ok(companion.includes('src="/icon.svg"'));
  assert.match(companion, /jess-transcript-messages/);
  assert.match(companionCss, /-webkit-app-region:drag/);
  assert.match(companionCss, /\.jess-orb-controls/);
});

test('authenticated workspace explicitly preserves the established dark background', () => {
  assert.match(workspaceCss, /--color-slate-950:\s*#020617/i);
  assert.match(workspaceCss, /color-scheme:\s*dark/i);
  assert.match(workspaceCss, /background-color:\s*#020617\s*!important/i);
  assert.match(layout, /backgroundColor:\s*"#020617"/);
});

test('Windows startup is explicit per-user opt-in, not an elevated scheduled task', () => {
  assert.match(main, /Start Hub-Mind at Windows sign-in \(this user\)/);
  assert.match(main, /app\.setLoginItemSettings\(\{ openAtLogin: item\.checked \}\)/);
  assert.match(main, /app\.getLoginItemSettings\(\)\.openAtLogin/);
});
