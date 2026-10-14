import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('electron');
test('native agent uses line-oriented JSON and emits verification fields',()=>{const s=fs.readFileSync(path.join(base,'jess-agent.ps1'),'utf8');assert.match(s,/ConvertFrom-Json/);assert.match(s,/ConvertTo-Json/);assert.match(s,/'list_windows'/);assert.match(s,/'screenshot'/);assert.match(s,/'read_screen_text'/);assert.match(s,/verified=/);assert.match(s,/BitConverter\]::ToUInt32/);assert.match(s,/horizontalDelta/);});
test('native bridge does not expose child process or filesystem to renderer',()=>{const s=fs.readFileSync(path.join(base,'preload.cjs'),'utf8');assert.match(s,/contextBridge\.exposeInMainWorld/);assert.doesNotMatch(s,/require\(['"]node:child_process/);assert.doesNotMatch(s,/exec\(/);});
