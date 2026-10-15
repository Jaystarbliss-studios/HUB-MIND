const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');
const { randomUUID } = require('node:crypto');

let child = null, nextId = 0, buffer = '';
let lastStartedAt = null, lastExitedAt = null, lastError = null, lastExitCode = null, lastExitSignal = null, lastStderr = null, lastScriptPath = null;
const pending = new Map();

function safeDiagnostic(value) {
  return String(value ?? '')
    .replace(/(token|password|secret|authorization)\s*[:=]\s*[^\s,;]+/ig, '$1=[redacted]')
    .slice(0, 500);
}

function resolveScriptPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'jess-agent.ps1')
    : path.join(__dirname, 'jess-agent.ps1');
}

function status() {
  const scriptPath = lastScriptPath || resolveScriptPath();
  return {
    available: process.platform === 'win32',
    running: !!child && child.exitCode === null && !child.killed,
    pid: child?.pid ?? null,
    pendingRequests: pending.size,
    lastStartedAt,
    lastExitedAt,
    lastError,
    lastExitCode,
    lastExitSignal,
    lastStderr,
    scriptExists: fs.existsSync(scriptPath),
    scriptPath,
  };
}
const MAX_RESPONSE_LINE_CHARS = 16 * 1024 * 1024;
const MAX_STDERR_CHARS = 1200;

function audit(event, details = {}) {
  try {
    const file = path.join(app.getPath('userData'), 'jess-agent-runtime.jsonl');
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), event, ...details }) + '\n', { encoding: 'utf8', mode: 0o600 });
  } catch (error) {
    console.warn('[Jess agent audit] Could not write runtime log:', error?.message || error);
  }
}

function ensureAgent() {
  if (child && child.exitCode === null) return child;
  const scriptPath = resolveScriptPath();
  lastScriptPath = scriptPath;
  if (!fs.existsSync(scriptPath)) { lastError = 'Jess native agent script is missing from this build: ' + scriptPath; throw new Error(lastError); }

  const spawned = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], shell: false,
  });
  child = spawned;
  lastStartedAt = new Date().toISOString();
  lastError = null;
  lastExitCode = null;
  lastExitSignal = null;
  lastStderr = null;
  spawned.stdout.setEncoding('utf8');
  audit('sidecar-started', { pid: spawned.pid, scriptPath });

  spawned.stdout.on('data', chunk => {
    buffer += chunk;
    if (buffer.length > MAX_RESPONSE_LINE_CHARS && !buffer.includes('\n')) {
      lastError = 'Native helper response exceeded the 16 MB protocol limit.';
      audit('sidecar-protocol-overflow', { pid: spawned.pid, bufferedChars: buffer.length, error: lastError });
      try { spawned.kill(); } catch {}
      return;
    }
    while (true) {
      const at = buffer.indexOf('\n');
      if (at < 0) break;
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (!line) continue;
      if (line.length > MAX_RESPONSE_LINE_CHARS) {
        lastError = 'Native helper returned a response line above the 16 MB protocol limit.';
        audit('sidecar-oversized-line', { pid: spawned.pid, chars: line.length, error: lastError });
        continue;
      }
      try {
        const message = JSON.parse(line);
        const wait = pending.get(message.id);
        if (wait) {
          pending.delete(message.id);
          clearTimeout(wait.timer);
          audit('action-completed', { method: wait.method, durationMs: Date.now() - wait.started, ok: message.result?.ok === true, verified: message.result?.verified === true });
          wait.resolve(message.result);
        }
      } catch (error) {
        lastError = safeDiagnostic('Native helper returned invalid JSON: ' + String(error?.message || error));
        audit('sidecar-invalid-json', { pid: spawned.pid, error: lastError });
      }
    }
  });

  spawned.stderr.on('data', chunk => {
    const message = safeDiagnostic(String(chunk).slice(0, MAX_STDERR_CHARS));
    lastStderr = message.slice(-500);
    lastError = lastStderr;
    console.warn('[Jess native agent]', message);
    audit('sidecar-stderr', { pid: spawned.pid, message });
  });
  spawned.on('error', error => {
    lastError = safeDiagnostic(error?.message || error);
    audit('sidecar-process-error', { pid: spawned.pid, error: lastError });
  });
  spawned.on('exit', (code, signal) => {
    lastExitedAt = new Date().toISOString();
    lastExitCode = code;
    lastExitSignal = signal;
    if (code !== 0 || signal) lastError = lastError || safeDiagnostic('Native helper exited (' + (code ?? signal ?? 'unknown') + ').');
    else if (pending.size > 0) lastError = safeDiagnostic('Native helper exited while requests were pending.');
    audit('sidecar-exited', { pid: spawned.pid, code, signal, pending: pending.size });
    for (const [id, wait] of pending) {
      clearTimeout(wait.timer);
      wait.reject(new Error('Jess native agent exited (' + (code ?? signal ?? 'unknown') + ')'));
      pending.delete(id);
    }
    if (child === spawned) child = null;
    buffer = '';
  });
  return spawned;
}

function call(method, args = {}, timeout = 15000) {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, verified: false, evidence: null, error: 'Native Windows control is only available in the Windows desktop build.' });
  let proc;
  try { proc = ensureAgent(); }
  catch (error) {
    lastError = safeDiagnostic(error?.message || error);
    audit('sidecar-start-failed', { method, error: lastError });
    return Promise.reject(new Error(lastError));
  }
  const id = (++nextId) + '-' + randomUUID();
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      lastError = safeDiagnostic('Native action timed out: ' + method + '.');
      audit('action-timeout', { method, durationMs: Date.now() - started, timeoutMs: timeout, error: lastError });
      if (child === proc && proc.exitCode === null) {
        try { proc.kill(); } catch {}
        child = null;
        buffer = '';
      }
      reject(new Error('Native action timed out: ' + method + '. The sidecar was stopped to prevent a hung command from blocking later actions.'));
    }, timeout);
    pending.set(id, { resolve, reject, timer, method, started });
    audit('action-started', { method, timeoutMs: timeout });
    proc.stdin.write(JSON.stringify({ id, method, args }) + '\n', error => {
      if (!error) return;
      const wait = pending.get(id);
      if (!wait) return;
      pending.delete(id);
      clearTimeout(timer);
      lastError = safeDiagnostic('Could not write request to native helper: ' + String(error?.message || error));
      audit('action-write-failed', { method, error: lastError });
      reject(new Error(lastError));
    });
  });
}

function stop() {
  if (child) {
    audit('sidecar-stop-requested', { pid: child.pid, pending: pending.size });
    try { child.kill(); } catch {}
    child = null;
  }
  for (const [id, wait] of pending) {
    clearTimeout(wait.timer);
    wait.reject(new Error('Jess native agent stopped'));
    pending.delete(id);
  }
}

app.on('before-quit', stop);
module.exports = { call, stop, status };
