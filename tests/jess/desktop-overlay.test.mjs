import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/pages/companion.css', import.meta.url), 'utf8');
const rootCss = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const electronMain = readFileSync(new URL('../../electron/main.cjs', import.meta.url), 'utf8');

test('desktop Jess overlay remains a compact orb and never expands into a transcript panel', () => {
  assert.match(css, /\.jess-orb-window\s*\{[^}]*width:\s*96px/s);
  assert.doesNotMatch(css, /\.jess-orb-window\.is-transcript-visible/);
  assert.doesNotMatch(css, /\.jess-transcript\s*\{/);
  assert.match(electronMain, /function createTranscriptOverlayWindow\(\)/);
  assert.ok(electronMain.includes("APP_URL + '/companion-transcript'"));
  assert.match(electronMain, /width: 96, height: 96, minWidth: 96, minHeight: 96/);
  assert.match(electronMain, /function createTranscriptOverlayWindow\(\)/);
  assert.match(electronMain, /movable: false, focusable: false/);
  assert.match(electronMain, /area\.x \+ \(area\.width - width\) \/ 2/);
  assert.match(electronMain, /Legacy compatibility only\. The movable companion remains an icon-only window/);
});

test('workspace palette remains dark regardless of Windows/browser theme preferences', () => {
  assert.match(rootCss, /color-scheme:\s*dark\s*!important/);
  assert.match(rootCss, /background-color:\s*#020617\s*!important/);
});

test('Electron desktop screen sharing checks permissions and opens an independent topmost glass overlay', async () => {
  const picker = readFileSync(new URL('../../electron/screen-share-picker.html', import.meta.url), 'utf8');
  assert.match(electronMain, /setPermissionCheckHandler/);
  assert.match(electronMain, /setDisplayMediaRequestHandler/);
  assert.match(electronMain, /Choose what to share/);
  assert.match(electronMain, /callback\(selected \? \{ video: selected \} : \{\}\)/);
  assert.match(electronMain, /chooseDisplaySource\(unique\)/);
  assert.match(electronMain, /transparent: true, backgroundColor: '#00000000'/);
  assert.match(electronMain, /alwaysOnTop: true, skipTaskbar: true/);
  assert.match(electronMain, /area\.x \+ \(area\.width - width\) \/ 2/);
  assert.match(electronMain, /picker\.focus\(\)/);
  assert.match(picker, /background:transparent/);
  assert.match(picker, /backdrop-filter:blur\(32px\) saturate\(175%\)/);
  assert.match(picker, /-webkit-app-region:drag/);
});
