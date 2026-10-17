import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/pages/companion.css', import.meta.url), 'utf8');
const rootCss = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const electronMain = readFileSync(new URL('../../electron/main.cjs', import.meta.url), 'utf8');

test('desktop Jess overlay remains a compact orb and never expands into a transcript panel', () => {
  assert.match(css, /\.jess-orb-window\s*\{[^}]*width:\s*96px/s);
  assert.match(electronMain, /createTranscriptOverlayWindow/);
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

test('Electron desktop screen sharing checks trusted-origin permissions and presents an explicit source chooser', () => {
  assert.match(electronMain, /setPermissionCheckHandler/);
  assert.match(electronMain, /setDisplayMediaRequestHandler/);
  assert.match(electronMain, /Choose what to share/);
  assert.match(electronMain, /callback\(selected \? \{ video: selected \} : \{\}\)/);
  assert.match(electronMain, /chooseDisplaySource\(unique\)/);
});
