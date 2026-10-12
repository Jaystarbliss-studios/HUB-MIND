import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/pages/companion.css', import.meta.url), 'utf8');
const rootCss = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const electronMain = readFileSync(new URL('../../electron/main.cjs', import.meta.url), 'utf8');

test('desktop Jess overlay remains a compact orb and never expands into a transcript panel', () => {
  assert.match(css, /\.jess-orb-window\.is-transcript-visible,\s*\.jess-orb-window\s*\{[^}]*width:\s*96px!important/s);
  assert.match(css, /\.jess-orb-window\.is-transcript-visible \.jess-transcript\s*\{\s*display:none!important/s);
  assert.match(electronMain, /const width = 96;\s*const height = 96;/);
  assert.match(electronMain, /The Windows desktop overlay is intentionally the Jess orb only/);
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
  assert.match(electronMain, /useSystemPicker:\s*true/);
});
