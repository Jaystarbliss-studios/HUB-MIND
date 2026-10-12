'use strict';
const net = require('node:net');
const crypto = require('node:crypto');

const PIPE_NAME = '\\\\.\\pipe\\hubmind-jess-chrome-v1';
const MAX_LINE = 1024 * 1024;
let server = null;
let client = null;
let buffer = '';
const pending = new Map();

function start() {
  if (process.platform !== 'win32' || server) return;
  server = net.createServer(socket => {
    if (client && !client.destroyed) { socket.destroy(); return; }
    client = socket;
    buffer = '';
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
        try { response = JSON.parse(line); } catch { continue; }
        const waiter = pending.get(String(response.id || ''));
        if (!waiter) continue;
        pending.delete(String(response.id));
        clearTimeout(waiter.timer);
        waiter.resolve(response.result || { ok: false, verified: false, error: 'Chrome extension returned an empty result.' });
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      if (client === socket) client = null;
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
  return { available: !!client && !client.destroyed, transport: 'Chrome Native Messaging', pipe: PIPE_NAME };
}

function request(method, args = {}, timeoutMs = 12000) {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, verified: false, error: 'Chrome native messaging is available only in the Windows desktop app.' });
  if (!client || client.destroyed) return Promise.resolve({ ok: false, verified: false, error: 'Chrome bridge is not connected. Install/enable the Jess Chrome extension and keep Hub-Mind running.' });
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
