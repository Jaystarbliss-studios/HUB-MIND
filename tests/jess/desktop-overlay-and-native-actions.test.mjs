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

test('desktop companion keeps the original icon and exposes a visible transcript overlay', async () => {
  const css = await read('../../src/pages/companion.css');
  const page = await read('../../src/pages/CompanionPage.tsx');
  assert.match(css, /width:100%;height:100%/);
  assert.match(css, /\.jess-transcript\{/);
  assert.match(page, /src="\/icon\.svg"/);
  assert.doesNotMatch(page, /src="\/jess-orb\.svg"/);
  assert.match(page, /hideCompanion/);
  assert.match(page, /moveCompanionBy/);
  assert.match(page, /onPointerMove/);
  assert.match(page, /jess-transcript-messages/);
  assert.match(page, /jess-transcript-messages/);
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
  assert.match(tools, /name: 'run_windows_command_native'/);
  assert.match(tools, /name: 'launch_windows_application'/);
});

test('desktop display capture does not silently grant screen sharing', async () => {
  const main = await read('../../electron/main.cjs');
  assert.match(main, /setDisplayMediaRequestHandler/);
  assert.match(main, /useSystemPicker:\s*true/);
  assert.match(main, /Share entire screen/);
});
