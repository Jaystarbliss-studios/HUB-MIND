import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJessOfflineCommand } from '../../src/services/jessOfflineCommands.ts';

test('offline command parser recognizes only explicit low-risk desktop commands', () => {
  assert.deepEqual(parseJessOfflineCommand('Open Notepad!'), {
    kind: 'native', method: 'launch_app', args: { name: 'notepad.exe' }, label: 'open Notepad',
  });
  assert.deepEqual(parseJessOfflineCommand('please show desktop'), {
    kind: 'native', method: 'show_desktop', args: {}, label: 'show the desktop',
  });
  assert.deepEqual(parseJessOfflineCommand('mute volume'), {
    kind: 'native', method: 'media_key', args: { action: 'volume_mute' }, label: 'mute the volume',
  });
  assert.deepEqual(parseJessOfflineCommand('switch windows'), {
    kind: 'native', method: 'switch_window', args: {}, label: 'switch windows',
  });
  assert.deepEqual(parseJessOfflineCommand('stop Jess'), {
    kind: 'stop', label: 'stop Full Control',
  });
});

test('offline command parser does not infer destructive, external or arbitrary text actions', () => {
  for (const phrase of [
    'delete my files',
    'send the email',
    'type my password',
    'run PowerShell and remove everything',
    'open my project and find the latest report',
    '',
  ]) {
    assert.equal(parseJessOfflineCommand(phrase), null, phrase);
  }
});
