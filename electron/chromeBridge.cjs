'use strict';
const net = require('node:net');
const crypto = require('node:crypto');

const PIPE_NAME = '\\\\.\\pipe\\hubmind-jess-chrome-v1';
const MAX_LINE = 1024 * 1024;
let server = null;
let client = null;
let buffer = '';
let authenticated = false;
let bridgeToken = null;
const pending = new Map();

function start(token) {
  bridgeToken = typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? token : null;
  if (!bridgeToken) { console.error('[Jess Chrome bridge] Refusing to start without a per-install authentication token.'); return; }
  if (process.platform !== 'win32' || server) return;
  server = net.createServer(socket => {
    if (client && !client.destroyed) { socket.destroy(); return; }
    client = socket;
    authenticated = false;
    buffer = '';
    const authTimer = setTimeout(() => { if (client === socket && !authenticated) socket.destroy(); }, 5000);
    socket.setEncoding('utf8');
    socket.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > MAX_LINE * 2) { socket.destroy(); return; }
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at).trim();
        buffer = buffer.slice(at + 1);
        if (!line) continue;
        let response;
        try { response = JSON.parse(line); } catch { socket.destroy(); return; }
        if (!authenticated) {
          const supplied = typeof response?.token === 'string' ? response.token : '';
          const expectedBytes = Buffer.from(bridgeToken, 'hex');
          const suppliedBytes = /^[a-f0-9]{64}$/.test(supplied) ? Buffer.from(supplied, 'hex') : Buffer.alloc(0);
          if (response?.type !== 'auth' || suppliedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
            socket.destroy();
            return;
          }
          authenticated = true;
          clearTimeout(authTimer);
          socket.write(JSON.stringify({ type: 'auth', ok: true }) + '\n');
          continue;
        }
        const waiter = pending.get(String(response.id || ''));
        if (!waiter) continue;
        pending.delete(String(response.id));
        clearTimeout(waiter.timer);
        waiter.resolve(response.result || { ok: false, verified: false, error: 'Chrome extension returned an empty result.' });
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      clearTimeout(authTimer);
      if (client === socket) client = null;
      if (client === null) authenticated = false;
      for (const [id, waiter] of pending) {
        clearTimeout(waiter.timer);
        waiter.resolve({ ok: false, verified: false, error: 'Chrome native messaging connection closed.' });
        pending.delete(id);
      }
    });
  });
  server.on('error', error => console.error('[Jess Chrome bridge]', error.message));
  server.listen(PIPE_NAME);
}

function status() {
  return { available: !!client && !client.destroyed && authenticated, transport: 'Chrome Native Messaging', pipe: PIPE_NAME, authenticated };
}

function request(method, args = {}, timeoutMs = 12000) {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, verified: false, error: 'Chrome native messaging is available only in the Windows desktop app.' });
  if (!client || client.destroyed || !authenticated) return Promise.resolve({ ok: false, verified: false, error: 'Chrome bridge is not authenticated. Use Jess Settings → Set up Chrome, then enable the extension.' });
  const id = crypto.randomUUID();
  const message = JSON.stringify({ id, method, args });
  if (Buffer.byteLength(message, 'utf8') > MAX_LINE) return Promise.resolve({ ok: false, verified: false, error: 'Chrome request exceeds the 1 MiB limit.' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, verified: false, error: 'Chrome action timed out: ' + method });
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    client.write(message + '\n', error => {
      if (!error) return;
      const waiter = pending.get(id);
      if (!waiter) return;
      pending.delete(id);
      clearTimeout(timer);
      resolve({ ok: false, verified: false, error: 'Chrome request could not be sent: ' + error.message });
    });
  });
}

function cancelPending(reason = 'Full Control Session stopped.') {
  const socket = client;
  client = null;
  for (const [id, waiter] of pending) {
    clearTimeout(waiter.timer);
    waiter.resolve({ ok: false, verified: false, error: reason });
    pending.delete(id);
  }
  try { socket?.destroy(); } catch {}
}

function stop() {
  cancelPending('Chrome bridge stopped.');
  try { server?.close(); } catch {}
  server = null;
}
module.exports = { start, stop, status, request, cancelPending };
