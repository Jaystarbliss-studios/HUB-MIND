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
const orb = fs.readFileSync(new URL('../../src/pages/JessOrbPage.tsx', import.meta.url), 'utf8');
const tools = fs.readFileSync(new URL('../../src/lib/jessTools.ts', import.meta.url), 'utf8');
const live = fs.readFileSync(new URL('../../src/services/liveAudioClient.ts', import.meta.url), 'utf8');

test('Jess voice sessions coordinate through a per-user Firestore lease', () => {
  assert.match(coordinator, /runTransaction/);
  assert.match(coordinator, /leaseUntil/);
  assert.match(coordinator, /watchJessSession/);
  assert.match(assistant, /claimJessSession/);
  assert.match(assistant, /renewJessSession/);
  assert.match(assistant, /releaseJessSession\(previousLease\.userId, previousLease\.sessionId\)/);
  assert.match(assistant, /Jess is already active in/);
  assert.match(assistant, /jessActivationRequest/);
  assert.match(assistant, /!isDesktopShell && !orbDismissed/);
  assert.match(companion, /windows-desktop-companion/);
  assert.match(companion, /watchJessSession/);
});

test('transparent companion styles are scoped only to the companion route', () => {
  assert.match(companionCss, /body:has\(\.jess-orb-window\)/);
  assert.doesNotMatch(companionCss, /^html,body,#root\{/);
  assert.doesNotMatch(app, /import '\.\/pages\/companion\.css';/);
});

test('desktop shows only the movable Jess orb when the workspace is minimized or hidden', () => {
  assert.match(electron, /positionCompanionBottomRight/);
  assert.match(electron, /mainWindow\\.on\\('show'.*companionWindow\\.hide\\(\\)/s);
  assert.match(electron, /mainWindow\\.on\\('restore'.*companionWindow\\.hide\\(\\)/s);
  assert.match(electron, /mainWindow\\.on\\('minimize'.*createCompanionWindow/s);
  assert.match(electron, /width: 96, height: 96/);
  assert.match(electron, /APP_URL \\+ '\\/orb'/);
  assert.match(electron, /hubmind:hide-companion/);
  assert.match(electron, /hubmind:move-companion-by/);
  assert.match(electron, /Math\\.max\\(area\\.x/);
  assert.match(orb, /jess-orb\\.svg/);
  assert.match(orb, /jess-orb-close/);
  assert.match(orb, /hideCompanion/);
  assert.doesNotMatch(orb, /transcript|textarea|microphone controls/i);
});

test('native Windows tools use a full-control session, narrow preload bridge and honesty protocol', () => {
  assert.match(tools, /jess_full_control/);
  assert.match(tools, /jess_stop/);
  assert.match(tools, /list_windows/);
  assert.match(tools, /manage_windows/);
  assert.match(tools, /take_windows_screenshot/);
  assert.match(tools, /run_windows_command_native/);
  assert.match(preload, /hubmind:native-action/);
  assert.match(preload, /hubmind:full-control-start/);
  assert.match(preload, /hubmind:full-control-stop/);
  assert.match(electron, /Ctrl\+Alt\+Shift\+J|CommandOrControl\+Alt\+Shift\+J/);
  assert.match(electron, /full-control-started/);
  assert.match(electron, /jess-native-audit\.jsonl/);
  assert.match(live, /NATIVE WINDOWS HONESTY PROTOCOL/);
  assert.match(live, /WEB RESEARCH/);
});
