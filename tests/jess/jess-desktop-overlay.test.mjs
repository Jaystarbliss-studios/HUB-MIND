import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('native Jess orb hides with the workspace and returns after minimize or close', () => {
  const main = read('../../electron/main.cjs');
  assert.match(main, /mainWindow\\.on\\('show'.*companionWindow\\.hide\\(\\)/s);
  assert.match(main, /mainWindow\\.on\\('restore'.*companionWindow\\.hide\\(\\)/s);
  assert.match(main, /mainWindow\\.on\\('minimize'.*createCompanionWindow/s);
  assert.match(main, /mainWindow\\.on\\('close'.*createCompanionWindow/s);
  assert.match(main, /width: 96, height: 96/);
  assert.match(main, /hubmind:move-companion-by/);
  assert.match(main, /hubmind:hide-companion/);
});

test('desktop orb displays only the Jess icon with a working hide control', () => {
  const orb = read('../../src/pages/JessOrbPage.tsx');
  assert.match(orb, /src="\\/jess-orb\\.svg"/);
  assert.match(orb, /jess-orb-close/);
  assert.match(orb, /hideCompanion/);
  assert.match(orb, /moveCompanionBy/);
  assert.doesNotMatch(orb, /transcript|textarea|microphone controls/i);
});

test('voice turns are mirrored into the cross-window desktop transcript cache', () => {
  const assistant = read('../../src/components/JessFloatingAssistant.tsx');
  assert.match(assistant, /function publishJessTranscript/);
  assert.match(assistant, /publishJessTranscript\(jessTranscriptTurnIdRef\.current/);
  assert.match(assistant, /publishJessTranscript\(`user-/);
});

test('native focus action brings a real Windows desktop window forward', () => {
  const agent = read('../../electron/jess-agent.ps1');
  assert.match(agent, /BringWindowToTop/);
  assert.match(agent, /SetForegroundWindow/);
});
