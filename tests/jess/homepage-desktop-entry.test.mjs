import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../../' + path, import.meta.url), 'utf8');

test('public landing page uses official branding and exposes workspace, install, desktop and Jess entry points', async () => {
  const [home, html, pkg, vite] = await Promise.all([
    read('src/pages/PublicHome.tsx'),
    read('index.html'),
    read('package.json').then(JSON.parse),
    read('vite.config.ts'),
  ]);
  assert.match(home, /src="\/hub-mind%20logo\.png"/);
  assert.match(home, /Open Workspace/);
  assert.match(home, /Get Invite/);
  assert.match(home, /installWebApp/);
  assert.match(home, /Get Jess Chrome extension/);
  assert.match(home, /Download for Windows/);
  assert.match(home, /Meet Jess/);
  assert.doesNotMatch(html, /Remix Hub-Mind/);
  assert.match(html, /<title>Hub-Mind<\/title>/);
  assert.equal(pkg.name, 'hub-mind');
  assert.match(vite, /start_url:\s*'\/login'/);
});

test('desktop and installed app start at sign-in, while the orb remains icon-only and dismissible', async () => {
  const [main, orb, css] = await Promise.all([
    read('electron/main.cjs'),
    read('src/pages/CompanionPage.tsx'),
    read('src/pages/companion.css'),
  ]);
  assert.match(main, /function createMainWindow\(initialPath = '\/login'\)/);
  assert.match(main, /APP_URL \+ '\/companion'/);
  assert.match(orb, /JessOrbVisualizer/);
  assert.match(orb, /jess-orb-controls/);
  assert.match(orb, /hideCompanion/);
  assert.match(orb, /moveCompanionBy/);
  assert.match(css, /is-transcript-visible \.jess-transcript\{display:flex\}/);
  assert.match(main, /screen-share-picker\.html/);
  assert.match(main, /callback\(selected \? \{ video: selected \} : \{\}\)/);
});

test('Jess has practical web search and screen-verification tools', async () => {
  const [tools, main, live] = await Promise.all([
    read('src/lib/jessTools.ts'),
    read('electron/main.cjs'),
    read('src/services/liveAudioClient.ts'),
  ]);
  assert.match(tools, /name: 'search_web'/);
  assert.match(tools, /name: 'take_windows_screenshot'/);
  assert.match(tools, /Search the public web for current information/);
  assert.match(main, /hubmind:native-action/);
  assert.match(main, /verified/);
  assert.match(live, /WEB RESEARCH/);
  assert.match(live, /SCREEN-SHARE ACTION VERIFICATION/);
});
