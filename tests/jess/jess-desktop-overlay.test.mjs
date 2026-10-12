import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('native Jess companion remains visible when the workspace is shown', () => {
  const main = read('../../electron/main.cjs');
  assert.match(main, /mainWindow\.on\('show', keepCompanionVisible\)/);
  assert.match(main, /mainWindow\.on\('restore', keepCompanionVisible\)/);
  assert.match(main, /companionWindow\.showInactive\(\)/);
  assert.doesNotMatch(main, /mainWindow\.on\('show',\s*\(\)\s*=>\s*\{\s*if\s*\(companionWindow[^\n]*companionWindow\.hide\(\)/);
  assert.match(main, /width: 420, height: 560/);
  assert.match(main, /setIgnoreMouseEvents\(true, \{ forward: true \}\)/);
  assert.match(main, /hubmind:set-companion-interactive/);
});

test('companion restores the original Jess icon and has a transcript panel', () => {
  const companion = read('../../src/pages/CompanionPage.tsx');
  const styles = read('../../src/pages/companion.css');
  assert.match(companion, /src="\/icon\.svg"/);
  assert.doesNotMatch(companion, /src="\/jess-orb\.svg"/);
  assert.match(companion, /jess-transcript-messages/);
  assert.match(companion, /setCompanionInteractive/);
  assert.match(companion, /hubmind\.jess\.desktopTranscript\.v1/);
  assert.match(styles, /\.jess-transcript\{/);
  assert.match(styles, /\.jess-transcript-messages\{/);
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
