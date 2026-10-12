import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const coordinator = fs.readFileSync(new URL('../../src/services/jessSessionCoordinator.ts', import.meta.url), 'utf8');
const assistant = fs.readFileSync(new URL('../../src/components/JessFloatingAssistant.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const companionCss = fs.readFileSync(new URL('../../src/pages/companion.css', import.meta.url), 'utf8');
const electron = fs.readFileSync(new URL('../../electron/main.cjs', import.meta.url), 'utf8');
const preload = fs.readFileSync(new URL('../../electron/preload.cjs', import.meta.url), 'utf8');
const companion = fs.readFileSync(new URL('../../src/pages/CompanionPage.tsx', import.meta.url), 'utf8');
const tools = fs.readFileSync(new URL('../../src/lib/jessTools.ts', import.meta.url), 'utf8');
const live = fs.readFileSync(new URL('../../src/services/liveAudioClient.ts', import.meta.url), 'utf8');

test('Jess voice sessions coordinate through a per-user Firestore lease', () => {
  assert.match(coordinator, /runTransaction/);
  assert.match(coordinator, /leaseUntil/);
  assert.match(coordinator, /watchJessSession/);
  assert.match(assistant, /claimJessSession/);
  assert.match(assistant, /renewJessSession/);
  assert.match(assistant, /Jess is already active in/);
  assert.match(assistant, /jessActivationRequest/);
  assert.match(companion, /windows-desktop-companion/);
  assert.match(companion, /watchJessSession/);
});

test('transparent companion styles are scoped only to the companion route', () => {
  assert.match(companionCss, /body:has\(\.jess-orb-window\)/);
  assert.doesNotMatch(companionCss, /^html,body,#root\{/);
  assert.doesNotMatch(app, /import '\.\/pages\/companion\.css';/);
});

test('desktop companion is moved to lower right and hidden when workspace is restored', () => {
  assert.match(electron, /positionCompanionBottomRight/);
  assert.match(electron, /mainWindow\.on\('show'.*companionWindow\.hide/s);
  assert.match(electron, /mainWindow\.on\('minimize'.*createCompanionWindow/s);
  assert.match(electron, /hubmind:hide-companion/);
  assert.match(electron, /hubmind:move-companion-by/);
  assert.match(electron, /Math\.max\(area\.x/);
  assert.match(companion, /jess-status-dot/);
});

test('native Windows tools are wired through the secure preload and require confirmation', () => {
  assert.match(tools, /type_into_active_windows_app/);
  assert.match(tools, /press_windows_shortcut/);
  assert.match(tools, /case 'type_into_active_windows_app'/);
  assert.match(tools, /case 'press_windows_shortcut'/);
  assert.match(preload, /hubmind:type-text/);
  assert.match(preload, /hubmind:press-shortcut/);
  assert.match(electron, /title: 'Type into the active Windows application\?'/);
  assert.match(electron, /title: 'Send a keyboard shortcut\?'/);
  assert.match(live, /WINDOWS DESKTOP CONTROL/);
  assert.match(live, /WEB RESEARCH/);
});
