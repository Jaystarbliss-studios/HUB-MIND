import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../../' + path, import.meta.url), 'utf8');

test('Chrome native host and desktop bridge use the same bounded named-pipe protocol', async () => {
  const [bridge, host, project] = await Promise.all([
    read('electron/chromeBridge.cjs'),
    read('native/JessChromeNativeHost/Program.cs'),
    read('native/JessChromeNativeHost/JessChromeNativeHost.csproj'),
  ]);
  assert.match(bridge, /hubmind-jess-chrome-v1/);
  assert.match(host, /hubmind-jess-chrome-v1/);
  assert.match(host, /ReadUInt32LittleEndian/);
  assert.match(host, /WriteUInt32LittleEndian/);
  assert.match(host, /MaxMessageBytes = 1024 \* 1024/);
  assert.match(project, /net8\.0/);
});

test('Chrome native host installer is pinned to the extension origin and registers per-user only', async () => {
  const [installer, manifest] = await Promise.all([
    read('scripts/install-jess-chrome-bridge.ps1'),
    read('chrome-extension/manifest.json'),
  ]);
  const extension = JSON.parse(manifest);
  assert.ok(extension.key);
  assert.match(installer, /HKCU:\\Software\\Google\\Chrome\\NativeMessagingHosts/);
  assert.match(installer, /baifedjcpcnkjjoikbafnkiombiaooai/);
  assert.match(installer, /allowed_origins/);
  assert.match(installer, /JessChromeNativeHost\.exe/);
});

test('Chrome actions are gated by the signed-in Full Control Session and close requires an explicit tab ID', async () => {
  const [main, tools, worker] = await Promise.all([
    read('electron/main.cjs'),
    read('src/lib/jessTools.ts'),
    read('chrome-extension/service-worker.js'),
  ]);
  assert.match(main, /Chrome control requires an active Full Control Session owned by the signed-in user/);
  assert.match(main, /hubmind:chrome-action/);
  assert.match(tools, /chrome_close_tab/);
  assert.match(worker, /A specific tabId is required to close a tab/);
  assert.match(worker, /chrome\.tabs\.query\(\{\}\)/);
});

test('offline Windows wake listener requires consent and uses local System.Speech', async () => {
  const [wake, main, preload, assistant] = await Promise.all([
    read('native/JessOfflineWake/Program.cs'),
    read('electron/main.cjs'),
    read('electron/preload.cjs'),
    read('src/components/JessFloatingAssistant.tsx'),
  ]);
  assert.match(wake, /System\.Speech\.Recognition/);
  assert.match(wake, /Windows System\.Speech offline recognizer/);
  assert.match(main, /Enable local Jess wake-word detection/);
  assert.match(main, /offlineWakeConsentGranted = choice\.response === 1/);
  assert.match(preload, /onOfflineWake/);
  assert.match(assistant, /startOfflineWake/);
});
