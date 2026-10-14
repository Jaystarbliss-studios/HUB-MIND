import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('electron');
test('native agent uses line-oriented JSON and emits verification fields',()=>{const s=fs.readFileSync(path.join(base,'jess-agent.ps1'),'utf8');assert.match(s,/ConvertFrom-Json/);assert.match(s,/ConvertTo-Json/);assert.match(s,/'list_windows'/);assert.match(s,/'screenshot'/);assert.match(s,/'read_screen_text'/);assert.match(s,/verified=/);assert.match(s,/BitConverter\]::ToUInt32/);assert.match(s,/horizontalDelta/);assert.match(s,/F24=135/);assert.match(s,/SendVirtualKeys/);assert.match(s,/'show_desktop'/);assert.match(s,/'minimize_all'/);assert.match(s,/'start_menu'/);assert.match(s,/'switch_window'/);assert.match(s,/'center-third'/);});
test('native bridge does not expose child process or filesystem to renderer',()=>{const s=fs.readFileSync(path.join(base,'preload.cjs'),'utf8');assert.match(s,/contextBridge\.exposeInMainWorld/);assert.doesNotMatch(s,/require\(['"]node:child_process/);assert.doesNotMatch(s,/exec\(/);});

test('native sidecar runtime records lifecycle, timeouts and rejects oversized protocol lines',()=>{const s=fs.readFileSync(path.join(base,'agentBridge.cjs'),'utf8');assert.match(s,/jess-agent-runtime\.jsonl/);assert.match(s,/action-timeout/);assert.match(s,/sidecar-exited/);assert.match(s,/MAX_RESPONSE_LINE_CHARS/);assert.match(s,/action-completed/);});
test('Chrome scroll supports a requested nested container and reports verification evidence',()=>{const s=fs.readFileSync(path.resolve('chrome-extension/service-worker.js'),'utf8');assert.match(s,/case 'chrome_scroll'/);assert.match(s,/const candidates = Array\.from\(document\.querySelectorAll/);assert.match(s,/const target = String\(a\.target/);assert.match(s,/verified: result\?\.result\?\.changed === true/);});
