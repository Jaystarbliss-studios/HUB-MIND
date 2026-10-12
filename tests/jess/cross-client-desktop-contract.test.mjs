import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const coordinator = fs.readFileSync(new URL('../../src/services/jessSessionCoordinator.ts', import.meta.url), 'utf8');
const assistant = fs.readFileSync(new URL('../../src/components/JessFloatingAssistant.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const companionCss = fs.readFileSync(new URL('../../src/pages/companion.css', import.meta.url), 'utf8');
const electron = fs.readFileSync(new URL('../../electron/main.cjs', import.meta.url), 'utf8');

test('Jess voice sessions coordinate through a per-user Firestore lease', () => {
  assert.match(coordinator, /runTransaction/);
  assert.match(coordinator, /leaseUntil/);
  assert.match(coordinator, /watchJessSession/);
  assert.match(assistant, /claimJessSession/);
  assert.match(assistant, /renewJessSession/);
  assert.match(assistant, /Jess is already active in/);
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
});
