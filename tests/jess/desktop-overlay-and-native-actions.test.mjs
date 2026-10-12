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

test('desktop companion is a compact, movable icon with visible close and workspace controls', async () => {
  const css = await read('../../src/pages/companion.css');
  const page = await read('../../src/pages/CompanionPage.tsx');
  assert.match(css, /width:116px;height:116px/);
  assert.match(css, /jess-orb-controls[^}]*opacity:1/);
  assert.match(page, /hideCompanion/);
  assert.match(page, /moveCompanionBy/);
  assert.match(page, /onPointerMove/);
});

test('native system actions use the isolated bridge and require explicit confirmation', async () => {
  const main = await read('../../electron/main.cjs');
  const preload = await read('../../electron/preload.cjs');
  const tools = await read('../../src/lib/jessTools.ts');
  assert.match(main, /hubmind:run-system-command/);
  assert.match(main, /dialog\.showMessageBox/);
  assert.match(main, /execFile\('powershell\.exe'/);
  assert.match(main, /assertTrustedSender\(event\)/);
  assert.match(preload, /runSystemCommand/);
  assert.match(tools, /name: 'run_windows_command'/);
  assert.match(tools, /name: 'launch_windows_app'/);
});

test('desktop display capture does not silently grant screen sharing', async () => {
  const main = await read('../../electron/main.cjs');
  assert.match(main, /setDisplayMediaRequestHandler/);
  assert.match(main, /useSystemPicker:\s*true/);
  assert.match(main, /Share entire screen/);
});
