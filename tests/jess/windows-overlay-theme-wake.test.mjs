import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../../' + path, import.meta.url), 'utf8');

test('workspace CSS explicitly fixes the original dark color scheme', async () => {
  const css = await read('src/index.css');
  assert.match(css, /:root\s*\{\s*color-scheme:\s*dark\s*;?\s*\}/);
  assert.match(css, /html, body, #root\s*\{[\s\S]*?background-color:\s*#020617/i);
});

test('Windows screen sharing never silently picks the first screen', async () => {
  const main = await read('electron/main.cjs');
  assert.match(main, /Choose what Jess can see/);
  assert.match(main, /sources\.slice\(0, 8\)\.map/);
  assert.match(main, /choice\.response > 0 \? sources\[choice\.response - 1\] : null/);
});

test('Windows desktop exposes guarded app, command, URL, typing and shortcut actions', async () => {
  const preload = await read('electron/preload.cjs');
  const main = await read('electron/main.cjs');
  for (const method of ['launchApp', 'runSystemCommand', 'openUrl', 'typeText', 'pressShortcut']) {
    assert.match(preload, new RegExp(method));
  }
  assert.match(main, /assertTrustedSender\(event\)/);
  assert.match(main, /Run this command/);
});

test('Jess wake listener accepts short interim wake phrases quickly', async () => {
  const wake = await read('src/services/jessWakeListener.ts');
  assert.match(wake, /interimWakeTimer = window\.setTimeout/);
  assert.match(wake, /\}, 180\);/);
});
